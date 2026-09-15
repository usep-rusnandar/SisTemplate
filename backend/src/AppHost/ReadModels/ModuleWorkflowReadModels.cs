using System.Globalization;

namespace IntegratedProcurement.AppHost.Api.ReadModels;

internal static class ModuleWorkflowReadModels
{
    private static readonly ProposalSummary[] Proposals =
    [
        new(
            "PR-2026-0142",
            "Hauling Service Pit B East",
            "PT Alamtri Site B",
            "Tender Invitation & Aanwijzing",
            "In Progress",
            "Sari Indah",
            "2026-06-18",
            "2026-06-27",
            72,
            "CIP-2026-0088"),
        new(
            "PR-2026-0137",
            "Heavy Equipment Rental 120T Excavator",
            "PT Alamtri Site A",
            "LOA Published",
            "Ready for CIP",
            "Andi Wijaya",
            "2026-06-11",
            "2026-06-24",
            100,
            "CIP-2026-0082"),
        new(
            "PR-2026-0129",
            "Fuel Transport Support",
            "PT Alamtri Logistics",
            "Commercial Evaluation",
            "Attention",
            "Rizky Pratama",
            "2026-06-07",
            "2026-06-21",
            58,
            null)
    ];

    private static readonly ProposalActivity[] ProposalActivities =
    [
        new("ACT-01", "Proposal Intake", "Completed", "Ayu Lestari", "2026-06-18", "2026-06-18"),
        new("ACT-02", "Vendor Distribution", "Completed", "Sari Indah", "2026-06-19", "2026-06-20"),
        new("ACT-03", "Invitation & Aanwijzing", "In Progress", "Sari Indah", "2026-06-21", "2026-06-24"),
        new("ACT-04", "Commercial Evaluation", "Queued", "Andi Wijaya", "2026-06-25", "2026-06-27"),
        new("ACT-05", "LOA Document", "Queued", "Andi Wijaya", "2026-06-27", "2026-06-27")
    ];

    private static readonly LoaDocument[] LoaDocuments =
    [
        new(
            "LOA-2026-0062",
            "PR-2026-0137",
            "Heavy Equipment Rental 120T Excavator",
            "PT Bumi Khatulistiwa Energi",
            "Ready for CIP",
            "2026-06-24",
            "Sari Indah",
            "CIP-2026-0082"),
        new(
            "LOA-2026-0059",
            "PR-2026-0122",
            "Crusher Maintenance Support",
            "PT Galangan Samudera",
            "Accepted by CIP",
            "2026-06-17",
            "Andi Wijaya",
            "CIP-2026-0076")
    ];

    private static readonly CipCaseSummary[] CipCases =
    [
        new(
            "CIP-2026-0088",
            "PR-2026-0142",
            "Hauling Service Pit B East",
            "PT Sinar Rejeki Equipment",
            "Termsheet Review",
            "Medium",
            "Nadia Kirana",
            "2026-06-27",
            66,
            "CM-2026-0046"),
        new(
            "CIP-2026-0082",
            "PR-2026-0137",
            "Heavy Equipment Rental 120T Excavator",
            "PT Bumi Khatulistiwa Energi",
            "Draft Contract",
            "High",
            "Fajar Nugroho",
            "2026-06-24",
            82,
            "CM-2026-0041"),
        new(
            "CIP-2026-0076",
            "PR-2026-0122",
            "Crusher Maintenance Support",
            "PT Galangan Samudera",
            "Final Review",
            "Low",
            "Nadia Kirana",
            "2026-06-19",
            93,
            null)
    ];

    private static readonly CipStage[] CipStages =
    [
        new("Verify LOA", "Completed", "Procurement Officer", "2026-06-24"),
        new("Generate Termsheet", "Completed", "Contract Analyst", "2026-06-25"),
        new("Select Template", "Completed", "Legal Admin", "2026-06-25"),
        new("Generate Draft Contract", "In Progress", "Legal Reviewer", "2026-06-26"),
        new("Register Final Contract", "Queued", "Contract Admin", "2026-06-28")
    ];

    private static readonly ContractSummary[] Contracts =
    [
        new(
            "CM-2026-0046",
            "CTR/ALM/HAUL/2026/046",
            "Hauling Service Pit B East",
            "PT Sinar Rejeki Equipment",
            "Drafting",
            "Sari Indah",
            "2026-07-01",
            "2027-06-30",
            "CIP-2026-0088",
            4_850_000_000m),
        new(
            "CM-2026-0041",
            "CTR/ALM/HEQ/2026/041",
            "Heavy Equipment Rental 120T Excavator",
            "PT Bumi Khatulistiwa Energi",
            "Active",
            "Andi Wijaya",
            "2026-06-28",
            "2027-06-27",
            "CIP-2026-0082",
            7_220_000_000m),
        new(
            "CM-2026-0034",
            "CTR/ALM/CRS/2026/034",
            "Crusher Maintenance Support",
            "PT Galangan Samudera",
            "Expiring Soon",
            "Rizky Pratama",
            "2025-07-15",
            "2026-07-14",
            "CIP-2026-0076",
            1_350_000_000m)
    ];

    private static readonly ContractMilestone[] ContractMilestones =
    [
        new("MS-01", "Contract Effective", "Completed", "2026-06-28"),
        new("MS-02", "First Mobilization", "Due Soon", "2026-07-05"),
        new("MS-03", "Quarterly Performance Review", "Planned", "2026-09-30"),
        new("MS-04", "Renewal Decision", "Planned", "2027-04-27")
    ];

    private static readonly ContractTimelineItem[] ContractTimeline =
    [
        new("2026-06-24", "Proposal Tracker LOA accepted by CIP", "Proposal Tracker", "Sari Indah"),
        new("2026-06-25", "Termsheet generated and reviewed", "Contract Initiation Platform", "Fajar Nugroho"),
        new("2026-06-28", "Final contract registered", "Contract Monitoring", "Andi Wijaya")
    ];

    public static ModuleDashboard TrackerDashboard() =>
        new(
            "Proposal Tracker",
            [
                new("Total proposal", FormatCount(Proposals.Length), "Proposal aktif di Proposal Tracker"),
                new("Ready for CIP", FormatCount(Proposals.Count(item => item.Status == "Ready for CIP")), "LOA siap diteruskan"),
                new("Attention", FormatCount(Proposals.Count(item => item.Status == "Attention")), "Butuh eskalasi SLA"),
                new("Avg progress", FormatPercent(Proposals.Average(item => item.ProgressPercent)), "Progress proposal aktif")
            ],
            [
                new("Proposal Tracker", "Proposal Intake", "Completed"),
                new("Proposal Tracker", "Distribution & Aanwijzing", "In Progress"),
                new("Proposal Tracker", "LOA Handoff", "Ready")
            ]);

    public static IReadOnlyCollection<ProposalSummary> ProposalList() => Proposals;

    public static ProposalDetail? ProposalDetail(string proposalId)
    {
        var proposal = Proposals.FirstOrDefault(item => IsMatch(item.ProposalId, proposalId));
        if (proposal is null)
        {
            return null;
        }

        return new ProposalDetail(
            proposal,
            ProposalActivities,
            LoaDocuments.Where(item => IsMatch(item.ProposalId, proposal.ProposalId)).ToArray(),
            proposal.CipCaseId is null
                ? null
                : new HandoffSummary("Proposal Tracker to CIP", proposal.CipCaseId, "LOA output is available for CIP contract review."));
    }

    public static WorkflowOutcome DistributeProposal(string proposalId) =>
        new("Distribution queued", proposalId, "SLA plan created. Estimated finish date remains bounded by requirement date.");

    public static WorkflowOutcome ActivityOutcome(string proposalId, string activityId, string action) =>
        new(action, proposalId, $"Activity {activityId} received action {action}.");

    public static IReadOnlyCollection<LoaDocument> LoaDocumentList() => LoaDocuments;

    public static ModuleDashboard CipDashboard() =>
        new(
            "Contract Initiation Platform",
            [
                new("Open cases", FormatCount(CipCases.Length), "Kasus kontrak aktif"),
                new("High priority", FormatCount(CipCases.Count(item => item.Priority == "High")), "Perlu perhatian legal"),
                new("Linked contracts", FormatCount(CipCases.Count(item => item.ContractId is not null)), "Sudah punya register CM"),
                new("Avg completion", FormatPercent(CipCases.Average(item => item.CompletionPercent)), "Progress review CIP")
            ],
            [
                new("CIP", "Verify LOA", "Completed"),
                new("CIP", "Termsheet & Template", "In Progress"),
                new("CIP", "Final Contract", "Queued")
            ]);

    public static IReadOnlyCollection<CipCaseSummary> CipCaseList() => CipCases;

    public static CipCaseDetail? CipCaseDetail(string caseId)
    {
        var cipCase = CipCases.FirstOrDefault(item => IsMatch(item.CaseId, caseId));
        if (cipCase is null)
        {
            return null;
        }

        return new CipCaseDetail(
            cipCase,
            CipStages,
            [
                new("Commercial terms complete", "No missing payment or delivery term detected.", "Low"),
                new("Penalty clause requires review", "Liquidated damage wording differs from preferred template.", "Medium"),
                new("Insurance attachment pending", "Vendor insurance evidence should be attached before final contract.", "High")
            ],
            cipCase.ContractId is null
                ? null
                : new HandoffSummary("CIP to Contract Monitoring", cipCase.ContractId, "Final contract registration has been prepared."));
    }

    public static WorkflowOutcome CipAction(string caseId, string action) =>
        new(action, caseId, $"CIP case {caseId} moved through {action}.");

    public static IReadOnlyCollection<CipTemplate> CipTemplates() =>
    [
        new("TPL-HEQ-001", "Heavy Equipment Rental", "Active", "Legal"),
        new("TPL-HAUL-002", "Hauling Service Agreement", "Active", "Legal"),
        new("TPL-MAINT-003", "Maintenance Support", "Review", "Contract Admin")
    ];

    public static IReadOnlyCollection<CipRepositoryDocument> CipRepository() =>
    [
        new("DOC-2026-071", "Executed Contract - HEQ Rental", "Contract", "2026-06-28"),
        new("DOC-2026-068", "Approved Termsheet - Crusher Maintenance", "Termsheet", "2026-06-19"),
        new("DOC-2026-062", "LOA - Heavy Equipment Rental", "LOA", "2026-06-24")
    ];

    public static CipAuthorizationMaster CipAuthorizationMaster() =>
        new("CIP Authorization Matrix", "2026-06-20", ["Contract Analyst", "Legal Reviewer", "Contract Admin"]);

    public static ModuleDashboard ContractDashboard() =>
        new(
            "Contract Monitoring",
            [
                new("Contracts", FormatCount(Contracts.Length), "Register aktif"),
                new("Active", FormatCount(Contracts.Count(item => item.Status == "Active")), "Kontrak berjalan"),
                new("Expiring soon", FormatCount(Contracts.Count(item => item.Status == "Expiring Soon")), "Perlu tindak lanjut"),
                new("Total value", FormatBillions(Contracts.Sum(item => item.ContractValue)), "Nilai kontrak terpantau")
            ],
            [
                new("Contract Monitoring", "Register", "In Progress"),
                new("Contract Monitoring", "Milestone Tracking", "Ready"),
                new("Contract Monitoring", "Expiry Reminder", "Ready")
            ]);

    public static IReadOnlyCollection<ContractSummary> ContractList() => Contracts;

    public static ContractDetail? ContractDetail(string contractId)
    {
        var contract = Contracts.FirstOrDefault(item => IsMatch(item.ContractId, contractId) || IsMatch(item.ContractNo, contractId));
        if (contract is null)
        {
            return null;
        }

        return new ContractDetail(contract, ContractMilestones, ContractTimeline);
    }

    public static IReadOnlyCollection<ContractSummary> ExpiringContracts() =>
        Contracts.Where(item => item.Status == "Expiring Soon").ToArray();

    public static IReadOnlyCollection<ReminderHistory> ReminderHistory() =>
    [
        new("REM-2026-011", "CM-2026-0034", "Expiry reminder sent", "2026-06-21", "Rizky Pratama"),
        new("REM-2026-010", "CM-2026-0041", "Mobilization reminder sent", "2026-06-20", "Andi Wijaya")
    ];

    public static ImportBatch ImportBatch(Guid batchId) =>
        new(batchId, "Validated", 42, 0, "Contract import batch is structurally valid.");

    private static bool IsMatch(string left, string right) =>
        string.Equals(left, right, StringComparison.OrdinalIgnoreCase);

    private static string FormatCount(int value) =>
        value.ToString("N0", CultureInfo.InvariantCulture);

    private static string FormatPercent(double value) =>
        $"{Math.Round(value, MidpointRounding.AwayFromZero).ToString("N0", CultureInfo.InvariantCulture)}%";

    private static string FormatBillions(decimal value) =>
        $"Rp {(value / 1_000_000_000m).ToString("N1", CultureInfo.InvariantCulture)}B";
}

internal sealed record ModuleDashboard(
    string Module,
    IReadOnlyCollection<DashboardMetric> Metrics,
    IReadOnlyCollection<WorkflowStep> Workflow);

internal sealed record DashboardMetric(string Label, string Value, string Description);

internal sealed record WorkflowStep(string Module, string Name, string Status);

internal sealed record ProposalSummary(
    string ProposalId,
    string Title,
    string Requester,
    string CurrentStage,
    string Status,
    string Owner,
    string CreatedAt,
    string RequirementDate,
    int ProgressPercent,
    string? CipCaseId);

internal sealed record ProposalActivity(
    string ActivityId,
    string Name,
    string Status,
    string Owner,
    string StartedAt,
    string EstimatedFinishAt);

internal sealed record LoaDocument(
    string LoaId,
    string ProposalId,
    string ProposalTitle,
    string VendorName,
    string Status,
    string IssuedAt,
    string IssuedBy,
    string? CipCaseId);

internal sealed record ProposalDetail(
    ProposalSummary Proposal,
    IReadOnlyCollection<ProposalActivity> Activities,
    IReadOnlyCollection<LoaDocument> LoaDocuments,
    HandoffSummary? CipHandoff);

internal sealed record HandoffSummary(string Flow, string ReferenceId, string Note);

internal sealed record WorkflowOutcome(string Status, string ReferenceId, string Message);

internal sealed record CipCaseSummary(
    string CaseId,
    string ProposalId,
    string Title,
    string VendorName,
    string Stage,
    string Priority,
    string Owner,
    string ReceivedAt,
    int CompletionPercent,
    string? ContractId);

internal sealed record CipStage(string Name, string Status, string OwnerRole, string TargetDate);

internal sealed record CipFinding(string Title, string Description, string Severity);

internal sealed record CipCaseDetail(
    CipCaseSummary Case,
    IReadOnlyCollection<CipStage> Stages,
    IReadOnlyCollection<CipFinding> Findings,
    HandoffSummary? ContractHandoff);

internal sealed record CipTemplate(string TemplateId, string Name, string Status, string Owner);

internal sealed record CipRepositoryDocument(string DocumentId, string Title, string Type, string UpdatedAt);

internal sealed record CipAuthorizationMaster(
    string Name,
    string UpdatedAt,
    IReadOnlyCollection<string> Roles);

internal sealed record ContractSummary(
    string ContractId,
    string ContractNo,
    string Title,
    string VendorName,
    string Status,
    string Owner,
    string EffectiveDate,
    string ExpiryDate,
    string SourceCaseId,
    decimal ContractValue);

internal sealed record ContractMilestone(string MilestoneId, string Name, string Status, string DueDate);

internal sealed record ContractTimelineItem(string EventDate, string Title, string SourceModule, string Actor);

internal sealed record ContractDetail(
    ContractSummary Contract,
    IReadOnlyCollection<ContractMilestone> Milestones,
    IReadOnlyCollection<ContractTimelineItem> Timeline);

internal sealed record ReminderHistory(
    string ReminderId,
    string ContractId,
    string Activity,
    string SentAt,
    string SentBy);

internal sealed record ImportBatch(
    Guid BatchId,
    string Status,
    int AcceptedRows,
    int RejectedRows,
    string Message);
