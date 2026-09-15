using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using IntegratedProcurement.Modules.ProposalTracker.Domain;
using IntegratedProcurement.Modules.VendorOnboarding.Application;

namespace IntegratedProcurement.Modules.ProposalTracker.Application;

/// <summary>
/// Command logic for the Proposal Tracker workflow: distribute, activity clock-in/complete/recycle/cancel,
/// officer reassignment, and LOA generation. Owns the state transitions and persistence through the
/// <see cref="IProposalTrackerRepository"/> port. Cross-cutting side effects (audit, notification) stay
/// with the caller, which receives the mutated entity to build them.
/// </summary>
public sealed class ProposalTrackerService : ITrackerWorkflowCommandPort
{
    private static readonly JsonSerializerOptions PayloadOptions = new(JsonSerializerDefaults.Web);

    private readonly IProposalTrackerRepository _repository;
    private readonly IRegisteredVendorReadPort _registeredVendors;

    public ProposalTrackerService(
        IProposalTrackerRepository repository,
        IRegisteredVendorReadPort registeredVendors)
    {
        _repository = repository;
        _registeredVendors = registeredVendors;
    }

    public async Task<TrackerDistributeResult> DistributeAsync(
        string proposalId,
        string? assignedOfficerName,
        string? trackerMethod,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerDistributeResult(false, null, null);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: true, cancellationToken);
        var firstActivity = activities.Count > 0 ? activities[0] : null;
        var officer = Clean(assignedOfficerName) ?? proposal.AssignedOfficerName ?? proposal.OwnerName ?? "Unassigned";
        proposal.SetTrackerMethod(trackerMethod);
        proposal.Distribute(officer, firstActivity?.Title ?? "Distributed");
        firstActivity?.ClockIn(DateTimeOffset.UtcNow);

        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerDistributeResult(true, proposal, officer);
    }

    public Task<TrackerActivityCommandResult> ClockInActivityAsync(string proposalId, string activityId, CancellationToken cancellationToken) =>
        MutateActivityAsync(proposalId, activityId, (proposal, activity, _) =>
        {
            activity.ClockIn(DateTimeOffset.UtcNow);
            proposal.SetWorkflowState("OnProgress", activity.Title);
        }, cancellationToken);

    public Task<TrackerActivityCommandResult> CompleteActivityAsync(string proposalId, string activityId, int? evidenceCount, DateTimeOffset? completedAt, CancellationToken cancellationToken) =>
        MutateActivityAsync(proposalId, activityId, (proposal, activity, activities) =>
            ApplyActivityCompletion(proposal, activity, activities, evidenceCount, completedAt), cancellationToken);

    public async Task<TrackerActivityCommandResult> CompleteStageAsync(
        string proposalId,
        string stageCode,
        int? evidenceCount,
        DateTimeOffset? completedAt,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerActivityCommandResult(false, false, null);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: true, cancellationToken);
        var normalizedCode = (stageCode ?? string.Empty).Trim().ToUpperInvariant();
        var activity = activities.FirstOrDefault(item => IsStage(item, normalizedCode));
        if (activity is null)
        {
            return new TrackerActivityCommandResult(true, false, proposal);
        }

        if (activity.Status != "Completed")
        {
            ApplyActivityCompletion(proposal, activity, activities, evidenceCount, completedAt);
        }
        else
        {
            ApplyActivityConsequences(proposal, activity, activities, activity.CompletedAt ?? completedAt ?? DateTimeOffset.UtcNow);
        }
        await _repository.SaveChangesAsync(cancellationToken);

        return new TrackerActivityCommandResult(true, true, proposal);
    }

    public async Task<TrackerActivityCommandResult> OpenParallelAfterTermAsync(
        string proposalId,
        DateTimeOffset? openedAt,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerActivityCommandResult(false, false, null);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: true, cancellationToken);
        var term = activities.FirstOrDefault(item => IsStage(item, "TERM"));
        if (term is null)
        {
            return new TrackerActivityCommandResult(true, false, proposal);
        }

        if (term.Status == "Locked")
        {
            return new TrackerActivityCommandResult(true, true, proposal);
        }

        var timestamp = openedAt ?? DateTimeOffset.UtcNow;
        foreach (var parallelActivity in activities.Where(item => IsStage(item, "LOA") || IsStage(item, "CTR")))
        {
            parallelActivity.Unlock(timestamp);
        }

        var pendingActivities = activities.Where(item => item.Status == "Pending").ToArray();
        var currentStage = pendingActivities.Length switch
        {
            0 => "Completed",
            1 => pendingActivities[0].Title,
            _ => string.Join(" · ", pendingActivities.Select(item => item.Title))
        };
        proposal.SetWorkflowState(pendingActivities.Length == 0 ? "Completed" : "OnProgress", currentStage);
        await _repository.SaveChangesAsync(cancellationToken);

        return new TrackerActivityCommandResult(true, true, proposal);
    }

    private static void ApplyActivityCompletion(
        TrackerProposal proposal,
        TrackerProposalActivity activity,
        IReadOnlyList<TrackerProposalActivity> activities,
        int? evidenceCount,
        DateTimeOffset? completedAt)
    {
        var timestamp = completedAt ?? DateTimeOffset.UtcNow;
        activity.Complete(timestamp, evidenceCount ?? activity.EvidenceCount);

        ApplyActivityConsequences(proposal, activity, activities, timestamp);
    }

    private static void ApplyActivityConsequences(
        TrackerProposal proposal,
        TrackerProposalActivity activity,
        IReadOnlyList<TrackerProposalActivity> activities,
        DateTimeOffset timestamp)
    {

        var activityIndex = activities.ToList().FindIndex(item => item.ActivityKey == activity.ActivityKey);
        if (IsStage(activity, "TERM"))
        {
            foreach (var parallelActivity in activities.Where(item => IsStage(item, "LOA") || IsStage(item, "CTR")))
            {
                parallelActivity.Unlock(timestamp);
            }
        }
        else if (activityIndex >= 0)
        {
            activities.Skip(activityIndex + 1).FirstOrDefault(item => item.Status == "Locked")?.Unlock(timestamp);
        }

        var pendingActivities = activities.Where(item => item.Status == "Pending").ToArray();
        var currentStage = pendingActivities.Length switch
        {
            0 => "Completed",
            1 => pendingActivities[0].Title,
            _ => string.Join(" · ", pendingActivities.Select(item => item.Title))
        };
        proposal.SetWorkflowState(pendingActivities.Length == 0 ? "Completed" : "OnProgress", currentStage);
    }

    public Task<TrackerActivityCommandResult> RecycleActivityAsync(string proposalId, string activityId, CancellationToken cancellationToken) =>
        MutateActivityAsync(proposalId, activityId, (proposal, activity, activities) =>
        {
            var lockFollowing = false;
            var recycledIsLoa = IsStage(activity, "LOA");
            foreach (var item in activities)
            {
                if (item.ActivityKey == activity.ActivityKey)
                {
                    lockFollowing = true;
                    item.Recycle(DateTimeOffset.UtcNow);
                    continue;
                }

                if (lockFollowing)
                {
                    // LOA and Contract are siblings opened together after Term Sheet. Recycling
                    // one must never roll the other sibling back or erase its progress.
                    if (recycledIsLoa && IsStage(item, "CTR"))
                    {
                        continue;
                    }
                    item.LockAfterRecycle(activity.Title);
                }
            }

            proposal.SetWorkflowState("OnProgress", activity.Title);
        }, cancellationToken);

    /// <summary>
    /// Recycle of LOA or Contract leaves CIP Term Sheet cases in place (parallel after Term Sheet).
    /// Recycle of Bid Evaluation / the award-defining step / Term Sheet / any earlier step invalidates
    /// those cases because winners (and therefore one-case-per-winner Term Sheets) may change.
    /// </summary>
    public static bool RecycleInvalidatesCipCases(
        TrackerProposalActivity recycled,
        IReadOnlyList<TrackerProposalActivity> activities)
    {
        if (IsStage(recycled, "LOA") || IsStage(recycled, "CTR"))
        {
            return false;
        }

        if (IsStage(recycled, "TERM") || IsStage(recycled, "EVAL"))
        {
            return true;
        }

        var hasEval = activities.Any(item => IsStage(item, "EVAL"));
        if (!hasEval && IsStage(recycled, "NEGO"))
        {
            return true;
        }

        var award = hasEval
            ? activities.FirstOrDefault(item => IsStage(item, "EVAL"))
            : activities.FirstOrDefault(item => IsStage(item, "NEGO"));
        if (award is null)
        {
            return false;
        }

        var list = activities.ToList();
        var recycledIndex = list.FindIndex(item => item.ActivityKey == recycled.ActivityKey);
        var awardIndex = list.FindIndex(item => item.ActivityKey == award.ActivityKey);
        return recycledIndex >= 0 && awardIndex >= 0 && recycledIndex <= awardIndex;
    }

    public Task<TrackerActivityCommandResult> CancelAsync(string proposalId, string activityId, CancellationToken cancellationToken) =>
        MutateActivityAsync(proposalId, activityId, (proposal, activity, activities) =>
        {
            var lockFollowing = false;
            foreach (var item in activities)
            {
                if (item.ActivityKey == activity.ActivityKey)
                {
                    lockFollowing = true;
                    item.Cancel(DateTimeOffset.UtcNow);
                    continue;
                }

                if (lockFollowing && item.Status is "Pending" or "Locked")
                {
                    item.LockAfterCancel();
                }
            }

            proposal.SetWorkflowState("Canceled", "Canceled");
        }, cancellationToken);

    public async Task<TrackerProposalCommandResult> ReassignOfficerAsync(string proposalId, string officer, CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerProposalCommandResult(false, null);
        }

        proposal.ReassignOfficer(officer);
        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerProposalCommandResult(true, proposal);
    }

    public async Task<TrackerProposalCommandResult> UpdateAribaIdAsync(string proposalId, string? aribaId, CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerProposalCommandResult(false, null);
        }

        proposal.SetAribaId(aribaId);
        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerProposalCommandResult(true, proposal);
    }

    // Must stay aligned with master data tracker-method.json (Proposal Tracker Method).
    private static readonly (string Id, string Name, int MinVendors, int MaxVendors, int DefaultVendors)[] SampleTrackerMethods =
    [
        ("TM-1", "Tender", 3, 6, 3),
        ("TM-2", "Pemilihan Langsung", 2, 6, 2),
        ("TM-3", "Penunjukan Langsung", 1, 1, 1),
    ];
    private sealed record SampleMaterialSpec(string Code, string Description, string Subclass, string Brand, decimal Quantity, decimal UnitPrice);
    private sealed record SampleScenario(
        string MethodId,
        string CommodityCode,
        string Commodity,
        string Department,
        string DepartmentSlug,
        string Jobsite,
        string Title,
        bool Contractual,
        string? ContractualType,
        SampleMaterialSpec[] Materials);
    // One catalog entry per method, cycled by row index so 5-of-the-same-method still vary.
    private static readonly SampleScenario[] SampleScenarios =
    [
        new("TM-1", "A.01.01", "A.01.01 Spare Parts", "Plant", "Plant", "ADMO",
            "Pengadaan Spare Parts Unit Dump Truck — ADMO FY2026", false, null,
            [
                new("SPA-DT-4012", "Filter oli hidrolik dump truck 100 ton", "Filter", "FleetGuard", 48, 4_250_000m),
                new("SPA-DT-1880", "Brake lining rear axle HD785", "Brake", "Komatsu Genuine", 16, 18_750_000m),
                new("SPA-DT-2204", "Hose hydraulic 1-1/4 in x 2.5 m", "Hose", "Gates", 36, 2_150_000m),
                new("SPA-DT-0911", "Seal kit final drive", "Seal", "OEM", 12, 9_800_000m),
            ]),
        new("TM-1", "B.02.03", "B.02.03 Heavy Equipment", "Plant", "Plant", "MACO",
            "Pengadaan Attachment Heavy Equipment — MACO FY2026", true, "Service Agreement",
            [
                new("HE-AT-110", "Bucket GP 3.5 m3 excavator 30 ton", "Attachment", "Esco", 2, 285_000_000m),
                new("HE-AT-214", "Ripper single shank D9", "Attachment", "Caterpillar", 1, 410_000_000m),
                new("HE-AT-088", "Quick coupler hydraulic 20-25 ton", "Attachment", "Miller", 3, 96_000_000m),
            ]),
        new("TM-2", "C.03.02", "C.03.02 Civil Works", "Mining", "Mining", "KIDE",
            "Pekerjaan Civil Works Haul Road — KIDE FY2026", true, "Service Agreement",
            [
                new("CW-HR-01", "Pekerjaan cut and fill haul road 2.4 km", "Earthwork", "SIS Civil", 1, 820_000_000m),
                new("CW-HR-02", "Agregat base class A 20 cm", "Pavement", "Local Quarry", 4_800, 185_000m),
                new("CW-HR-03", "Culvert beton pracetak D1200", "Drainage", "Wika Beton", 18, 12_500_000m),
                new("CW-HR-04", "Geotextile non-woven 200 gsm", "Geosynthetic", "Polyfelt", 12_000, 18_500m),
            ]),
        new("TM-2", "E.05.02", "E.05.02 Consumables", "HSE", "HSE", "SERA",
            "Pengadaan Consumables Safety Site — SERA FY2026", false, null,
            [
                new("HSE-PPE-01", "Safety helmet V-Gard with chin strap", "PPE", "MSA", 400, 185_000m),
                new("HSE-PPE-14", "Safety shoes S3 composite toe", "PPE", "Kings", 350, 420_000m),
                new("HSE-CON-08", "Ear plug dispenser refill 200 pcs", "Consumable", "3M", 80, 95_000m),
                new("HSE-CON-22", "Spill kit 120 L oil only", "Environment", "Brady", 24, 2_750_000m),
            ]),
        new("TM-3", "D.04.01", "D.04.01 IT Services", "General Affair", "GeneralAffair", "JAHO",
            "Jasa Implementasi Integrasi Vendor Portal — JAHO FY2026", true, "Service Agreement",
            [
                new("IT-SVC-310", "Jasa implementasi integrasi API vendor portal", "Professional Service", "In-house", 1, 980_000_000m),
                new("IT-SVC-311", "Lisensi middleware 12 bulan", "License", "WSO2", 1, 245_000_000m),
                new("IT-SVC-312", "Knowledge transfer onsite 10 hari", "Training", "In-house", 10, 8_500_000m),
            ]),
        new("TM-3", "D.04.01", "D.04.01 IT Services", "Logistic", "Logistic", "NARO",
            "Jasa Maintenance Aplikasi Warehouse — NARO FY2026", true, "Service Agreement",
            [
                new("IT-MNT-01", "AM paket warehouse app 12 bulan", "Managed Service", "Support", 12, 42_000_000m),
                new("IT-MNT-02", "Onsite support engineer 4 visit", "Support", "Support", 4, 18_500_000m),
            ]),
    ];

    /// <summary>
    /// Creates ReadyToDistribute sample proposals owned by the given Section Head. Used while
    /// E-Proposal ingest is unavailable so Tracker (and downstream modules) can be exercised.
    /// Recommended vendors are sliced from Vendor Database companies in status Registered (RGSTD).
    /// </summary>
    public async Task<TrackerSampleDataResult> GenerateSampleDataAsync(
        string ownerName,
        IReadOnlyList<SampleProposalItemInput> items,
        CancellationToken cancellationToken)
    {
        var owner = Clean(ownerName);
        if (owner is null)
        {
            return new TrackerSampleDataResult(false, "owner_required", Array.Empty<TrackerProposal>());
        }

        if (items is null || items.Count is < 1 or > 5)
        {
            return new TrackerSampleDataResult(false, "sample_count_invalid", Array.Empty<TrackerProposal>());
        }

        var registered = await _registeredVendors.ListRegisteredAsync(cancellationToken);
        if (registered.Count == 0)
        {
            return new TrackerSampleDataResult(false, "registered_vendors_insufficient", Array.Empty<TrackerProposal>());
        }

        var created = new List<TrackerProposal>(items.Count);
        var stamp = DateTime.UtcNow.ToString("HHmmss", CultureInfo.InvariantCulture);
        var year = DateTime.UtcNow.Year.ToString(CultureInfo.InvariantCulture);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var method = ResolveSampleTrackerMethod(item.TrackerMethod);
            if (method is null)
            {
                return new TrackerSampleDataResult(false, "tracker_method_invalid", Array.Empty<TrackerProposal>());
            }

            if (item.RequirementDate is null)
            {
                return new TrackerSampleDataResult(false, "requirement_date_required", Array.Empty<TrackerProposal>());
            }

            var vendorCount = item.TotalVendor;
            if (vendorCount < method.Value.MinVendors || vendorCount > method.Value.MaxVendors)
            {
                return new TrackerSampleDataResult(false, "total_vendor_invalid", Array.Empty<TrackerProposal>());
            }

            if (vendorCount > registered.Count)
            {
                return new TrackerSampleDataResult(false, "registered_vendors_insufficient", Array.Empty<TrackerProposal>());
            }

            var scenario = ResolveSampleScenario(method.Value.Id, i);
            var vendorStart = (i * 3 + vendorCount) % registered.Count;
            var vendors = Enumerable.Range(0, vendorCount)
                .Select(offset => registered[(vendorStart + offset) % registered.Count])
                .Select(v => new
                {
                    vendorId = v.VendorId,
                    vendorName = v.VendorName,
                    director = v.PicName ?? string.Empty,
                    address = v.OfficeAddress ?? string.Empty,
                })
                .ToArray();

            var materials = BuildSampleMaterials(scenario, item.RequirementDate.Value, item.Amount);
            var amount = materials.Sum(row => row.totalPrice);
            var assignedOfficer = Clean(item.AssignedOfficerName);
            var lastStepCode = Clean(item.LastStepCode);
            var contractType = scenario.Contractual ? "Contractual" : "Non Contractual";
            var proposalKey = $"{year}/{scenario.CommodityCode}/{scenario.DepartmentSlug}/{scenario.Jobsite}/SMP{stamp}{(i + 1):00}";
            var aribaId = $"DOC{Random.Shared.Next(100000000, 999999999)}";
            var payloadJson = JsonSerializer.Serialize(new
            {
                source = "sample",
                recommendedVendors = vendors,
                lastStepCode,
                sampleMaterials = materials,
            }, PayloadOptions);

            var proposal = new TrackerProposal(
                Guid.NewGuid(),
                proposalKey,
                proposalKey,
                scenario.Title,
                aribaId,
                scenario.Commodity,
                scenario.Jobsite,
                scenario.Department,
                contractType,
                scenario.ContractualType,
                amount,
                method.Value.Id,
                "ReadyToDistribute",
                string.Empty,
                "Normal",
                owner,
                assignedOfficer,
                item.RequirementDate,
                0,
                0,
                0,
                payloadJson);

            _repository.AddProposal(proposal);
            created.Add(proposal);
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerSampleDataResult(true, null, created);
    }

    private sealed record SampleMaterialPayload(
        string materialCode,
        string materialDescription,
        string materialSubclass,
        string brand,
        decimal quantity,
        decimal estimatedPrice,
        decimal totalPrice,
        string currency,
        string requiredDate,
        string jobsite,
        string plant,
        string? contractNo,
        string? contractName);

    private static SampleScenario ResolveSampleScenario(string methodId, int index)
    {
        var matches = SampleScenarios.Where(item => item.MethodId == methodId).ToArray();
        if (matches.Length == 0)
        {
            matches = SampleScenarios;
        }

        return matches[index % matches.Length];
    }

    private static SampleMaterialPayload[] BuildSampleMaterials(SampleScenario scenario, DateOnly requirementDate, decimal? requestedAmount)
    {
        var rawTotal = scenario.Materials.Sum(item => item.Quantity * item.UnitPrice);
        var scale = requestedAmount is > 0 && rawTotal > 0 ? requestedAmount.Value / rawTotal : 1m;
        return scenario.Materials.Select(item =>
        {
            var estimated = Math.Round(item.UnitPrice * scale, 0, MidpointRounding.AwayFromZero);
            var total = Math.Round(item.Quantity * estimated, 0, MidpointRounding.AwayFromZero);
            return new SampleMaterialPayload(
                item.Code,
                item.Description,
                item.Subclass,
                item.Brand,
                item.Quantity,
                estimated,
                total,
                "IDR",
                requirementDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                scenario.Jobsite,
                scenario.Jobsite,
                null,
                null);
        }).ToArray();
    }

    private static (string Id, string Name, int MinVendors, int MaxVendors, int DefaultVendors)? ResolveSampleTrackerMethod(string? value)
    {
        var key = Clean(value);
        if (key is null)
        {
            return null;
        }

        foreach (var method in SampleTrackerMethods)
        {
            if (string.Equals(method.Id, key, StringComparison.OrdinalIgnoreCase)
                || string.Equals(method.Name, key, StringComparison.OrdinalIgnoreCase))
            {
                return method;
            }
        }

        // Accept common misspelling from business copy: Penunjukkan.
        if (key.Contains("penunjuk", StringComparison.OrdinalIgnoreCase))
        {
            return SampleTrackerMethods.First(m => m.Id == "TM-3");
        }

        if (key.Contains("pemilihan", StringComparison.OrdinalIgnoreCase))
        {
            return SampleTrackerMethods.First(m => m.Id == "TM-2");
        }

        if (key.Contains("tender", StringComparison.OrdinalIgnoreCase))
        {
            return SampleTrackerMethods.First(m => m.Id == "TM-1");
        }

        return null;
    }

    public async Task<TrackerLoaResult> GenerateLoaDocumentAsync(
        string proposalId,
        string activityId,
        string? vendorId,
        string? vendorName,
        string? loaNumber,
        decimal? awardValue,
        decimal? awardPercent,
        string? fileName,
        DateTimeOffset? generatedAt,
        string? container,
        string? blobKey,
        JsonElement? payload,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerLoaResult(false, null, string.Empty);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: false, cancellationToken);
        var activity = activities.FirstOrDefault(item => item.ActivityKey == activityId);
        if (activity is null || !IsStage(activity, "LOA"))
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "loa_activity_not_found");
        }
        if (activity.Status != "Pending")
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "loa_activity_not_open");
        }

        var awardedVendors = await _repository.GetAwardResultVendorsAsync(proposal.ProposalKey, cancellationToken);
        var requestedVendorId = Clean(vendorId);
        var awardedVendor = awardedVendors.FirstOrDefault(item => item.IsWinner
            && string.Equals(item.VendorId, requestedVendorId, StringComparison.OrdinalIgnoreCase));
        if (awardedVendor is null)
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "winner_vendor_required");
        }

        var resolvedVendorId = awardedVendor.VendorId;
        var resolvedVendorName = awardedVendor.VendorName;
        var resolvedGeneratedAt = generatedAt ?? DateTimeOffset.UtcNow;
        var document = await _repository.FindLoaDocumentAsync(proposal.ProposalKey, activityId, resolvedVendorId, cancellationToken);
        var preservedCompletedAt = document is null ? null : ReadLoaCompletedAt(document.PayloadJson);
        var preservedRemark = document is null ? null : ReadLoaJsonString(document.PayloadJson, "completedRemark");
        var payloadJson = JsonSerializer.Serialize(new
        {
            LoaNumber = loaNumber,
            VendorId = resolvedVendorId,
            VendorName = resolvedVendorName,
            AwardValue = awardedVendor.AwardValue,
            AwardPercent = awardedVendor.AwardPercent,
            GeneratedAt = resolvedGeneratedAt,
            FileName = fileName,
            Container = Clean(container),
            BlobKey = Clean(blobKey),
            Payload = payload,
            CompletedAt = preservedCompletedAt,
            CompletedRemark = preservedRemark
        }, PayloadOptions);
        if (document is null)
        {
            _repository.AddLoaDocument(new TrackerLoaDocument(
                Guid.NewGuid(),
                proposal.ProposalKey,
                activityId,
                resolvedVendorId,
                loaNumber,
                resolvedVendorName,
                awardedVendor.AwardValue,
                awardedVendor.AwardPercent,
                resolvedGeneratedAt,
                Clean(fileName) ?? $"{proposal.ProposalKey}-{activityId}-{resolvedVendorId}.pdf",
                payloadJson));
        }
        else
        {
            document.UpdateFrom(
                loaNumber,
                resolvedVendorName,
                awardedVendor.AwardValue,
                awardedVendor.AwardPercent,
                resolvedGeneratedAt,
                Clean(fileName) ?? document.FileName,
                payloadJson);
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerLoaResult(true, proposal, resolvedVendorName);
    }

    public async Task<TrackerLoaResult> CompleteLoaVendorAsync(
        string proposalId,
        string activityId,
        string? vendorId,
        DateTimeOffset? completedAt,
        string? remark,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerLoaResult(false, null, string.Empty);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: true, cancellationToken);
        var activity = activities.FirstOrDefault(item => item.ActivityKey == activityId);
        if (activity is null || !IsStage(activity, "LOA"))
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "loa_activity_not_found");
        }
        if (activity.Status != "Pending" && activity.Status != "Completed")
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "loa_activity_not_open");
        }

        var awardedVendors = await _repository.GetAwardResultVendorsAsync(proposal.ProposalKey, cancellationToken);
        var requestedVendorId = Clean(vendorId);
        var awardedVendor = awardedVendors.FirstOrDefault(item => item.IsWinner
            && string.Equals(item.VendorId, requestedVendorId, StringComparison.OrdinalIgnoreCase));
        if (awardedVendor is null)
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "winner_vendor_required");
        }

        var document = await _repository.FindLoaDocumentAsync(proposal.ProposalKey, activityId, awardedVendor.VendorId, cancellationToken);
        if (document is null)
        {
            return new TrackerLoaResult(true, proposal, string.Empty, "loa_document_not_found");
        }

        var timestamp = completedAt ?? DateTimeOffset.UtcNow;
        document.UpdateFrom(
            document.LoaNumber,
            document.VendorName,
            document.AwardValue,
            document.AwardPercent,
            document.GeneratedAt,
            document.FileName,
            WithLoaCompletedAt(document.PayloadJson, timestamp, remark));

        var winners = awardedVendors.Where(item => item.IsWinner).ToArray();
        var allWinnersComplete = winners.Length > 0;
        foreach (var winner in winners)
        {
            var loa = winner.VendorId == awardedVendor.VendorId
                ? document
                : await _repository.FindLoaDocumentAsync(proposal.ProposalKey, activityId, winner.VendorId, cancellationToken);
            if (loa is null || ReadLoaCompletedAt(loa.PayloadJson) is null)
            {
                allWinnersComplete = false;
                break;
            }
        }

        if (allWinnersComplete && activity.Status != "Completed")
        {
            ApplyActivityCompletion(proposal, activity, activities, evidenceCount: winners.Length, completedAt: timestamp);
        }

        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerLoaResult(true, proposal, awardedVendor.VendorName);
    }

    private static DateTimeOffset? ReadLoaCompletedAt(string? payloadJson)
    {
        var raw = ReadLoaJsonString(payloadJson, "completedAt");
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed)
            ? parsed
            : null;
    }

    private static string? ReadLoaJsonString(string? payloadJson, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                return property.Value.ValueKind switch
                {
                    JsonValueKind.String => property.Value.GetString(),
                    JsonValueKind.Null => null,
                    _ => property.Value.GetRawText()
                };
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static string WithLoaCompletedAt(string? payloadJson, DateTimeOffset completedAt, string? remark)
    {
        var node = JsonNode.Parse(string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson) as JsonObject
            ?? new JsonObject();
        node["completedAt"] = completedAt.ToString("O");
        if (!string.IsNullOrWhiteSpace(remark))
        {
            node["completedRemark"] = remark;
        }

        return node.ToJsonString(PayloadOptions);
    }

    private static bool IsStage(TrackerProposalActivity activity, string stageCode)
    {
        var title = activity.Title.Trim();
        var stageId = activity.StageId.Trim();
        return stageCode switch
        {
            "EVAL" => title.Contains("Bid Evaluation", StringComparison.OrdinalIgnoreCase)
                || stageId.Equals("EVAL", StringComparison.OrdinalIgnoreCase)
                || stageId.Equals("TS-5", StringComparison.OrdinalIgnoreCase),
            "NEGO" => title.Equals("Negotiation", StringComparison.OrdinalIgnoreCase)
                || title.Contains("Negotiation", StringComparison.OrdinalIgnoreCase)
                || stageId.Equals("NEGO", StringComparison.OrdinalIgnoreCase)
                || stageId.Equals("TS-4", StringComparison.OrdinalIgnoreCase),
            "TERM" => title.Equals("Term Sheet", StringComparison.OrdinalIgnoreCase)
                || title.Equals("Termsheet", StringComparison.OrdinalIgnoreCase),
            "LOA" => title.Equals("LOA", StringComparison.OrdinalIgnoreCase)
                || title.Contains("Letter of Award", StringComparison.OrdinalIgnoreCase),
            "CTR" => title.Equals("Contract", StringComparison.OrdinalIgnoreCase),
            _ => stageId.Equals(stageCode, StringComparison.OrdinalIgnoreCase)
        };
    }

    /// <summary>Read the proposal's award result (header + per-vendor lines), or null if none/unknown proposal.</summary>
    public async Task<AwardResultView?> GetAwardResultAsync(string proposalId, CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: false, cancellationToken);
        return proposal is null ? null : await BuildAwardResultViewAsync(proposal.ProposalKey, cancellationToken);
    }

    /// <summary>Upsert the award-result header and replace-all its vendor lines for a proposal.</summary>
    public async Task<SaveAwardResultResult> SaveAwardResultAsync(SaveAwardResultCommand command, CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(command.ProposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new SaveAwardResultResult(false, null);
        }

        var key = proposal.ProposalKey;
        var now = DateTimeOffset.UtcNow;
        var source = Clean(command.Source) ?? "BidEvaluation";
        var payloadJson = string.IsNullOrWhiteSpace(command.PayloadJson) ? "{}" : command.PayloadJson;

        var header = await _repository.GetAwardResultAsync(key, tracking: true, cancellationToken);
        if (header is null)
        {
            _repository.AddAwardResult(new ProposalAwardResult(
                Guid.NewGuid(), key, source, Clean(command.Method), now, Clean(command.EvaluatedBy), Clean(command.Notes), payloadJson));
        }
        else
        {
            header.UpdateFrom(source, Clean(command.Method), now, Clean(command.EvaluatedBy), Clean(command.Notes), payloadJson);
        }

        var vendors = (command.Vendors ?? []).Select(v => new ProposalAwardResultVendor(
            Guid.NewGuid(), key, v.VendorId, v.VendorName, v.BidPrice, v.TechnicalScore, v.CommercialScore,
            v.TotalScore, v.Rank, v.NegotiatedValue, v.AwardValue, v.AwardPercent, v.IsWinner,
            string.IsNullOrWhiteSpace(v.PayloadJson) ? "{}" : v.PayloadJson)).ToArray();

        await _repository.ReplaceAwardResultVendorsAsync(key, vendors, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return new SaveAwardResultResult(true, await BuildAwardResultViewAsync(key, cancellationToken));
    }

    private async Task<AwardResultView?> BuildAwardResultViewAsync(string proposalKey, CancellationToken cancellationToken)
    {
        var header = await _repository.GetAwardResultAsync(proposalKey, tracking: false, cancellationToken);
        var vendors = await _repository.GetAwardResultVendorsAsync(proposalKey, cancellationToken);
        if (header is null && vendors.Count == 0)
        {
            return null;
        }

        return new AwardResultView(
            proposalKey,
            header?.Source ?? string.Empty,
            header?.Method,
            header?.EvaluatedAt,
            header?.EvaluatedBy,
            header?.Notes,
            vendors.Select(v => new AwardResultVendorView(
                v.VendorId, v.VendorName, v.BidPrice, v.TechnicalScore, v.CommercialScore, v.TotalScore,
                v.Rank, v.NegotiatedValue, v.AwardValue, v.AwardPercent, v.IsWinner)).ToArray());
    }

    private async Task<TrackerActivityCommandResult> MutateActivityAsync(
        string proposalId,
        string activityId,
        Action<TrackerProposal, TrackerProposalActivity, IReadOnlyList<TrackerProposalActivity>> mutate,
        CancellationToken cancellationToken)
    {
        var proposal = await _repository.GetProposalAsync(proposalId, tracking: true, cancellationToken);
        if (proposal is null)
        {
            return new TrackerActivityCommandResult(false, false, null);
        }

        var activities = await _repository.GetActivitiesAsync(proposal.ProposalKey, tracking: true, cancellationToken);
        var activity = activities.SingleOrDefault(item => item.ActivityKey == activityId);
        if (activity is null)
        {
            return new TrackerActivityCommandResult(true, false, proposal);
        }

        mutate(proposal, activity, activities);
        await _repository.SaveChangesAsync(cancellationToken);
        return new TrackerActivityCommandResult(true, true, proposal);
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
