namespace IntegratedProcurement.Modules.VendorOnboarding.Domain;

/// <summary>
/// Vendor lifecycle status codes. The vocabulary is owned by the <c>vendor-status</c> master-data set —
/// these constants name the codes the application writes by itself, and they must exist there.
/// <para>
/// The transitions still live in code (the Vendor aggregate and the approval workflow decide WHEN a
/// status changes); master data decides WHICH codes exist and how they are labelled. The set's
/// <c>NextId</c> chain is not read at runtime. Approval steps carry their own configured status, so a
/// route longer than three steps no longer needs an extra hardcoded tier.
/// </para>
/// </summary>
public static class VendorStatuses
{
    /// <summary>Imported existing data. Officer must invite the vendor before registration starts.</summary>
    public const string Initial = "INITL";
    public const string Invited = "INVTD";
    public const string Responded = "RSPND";
    public const string Draft = "DRAFT";
    public const string Submitted = "SBMIT";
    public const string Repair = "REPIR";           // revision requested
    public const string Rejected = "RJCTD";
    // Approval tiers, as in the legacy data. WHO approves each tier is configuration
    // (`approverRoleCode` on the master record), deliberately not baked into the code.
    public const string Approval1 = "APPR1";
    public const string Approval2 = "APPR2";
    public const string Approved = "APPRV";
    public const string Registered = "RGSTD";
    public const string Blacklisted = "BLACK";

    /// <summary>Every status the running application writes on its own (labels come from master data).
    /// An approval step may additionally be configured with any other code from the master set.</summary>
    public static IReadOnlyCollection<string> All =>
    [
        Initial, Invited, Responded, Draft, Submitted, Repair, Rejected,
        Approval1, Approval2, Approved, Registered, Blacklisted,
    ];

    /// <summary>Officer can send a registration invitation against this imported vendor.</summary>
    public static bool AllowsOfficerReinvite(string status) =>
        string.Equals(status, Initial, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// A new invitation may bind to this existing vendor: unused import (<see cref="Initial"/>)
    /// or an invited vendor that has not set a password yet (<see cref="Invited"/>).
    /// </summary>
    public static bool AllowsOfficerInviteReuse(string? status) =>
        string.Equals(status, Initial, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, Invited, StringComparison.OrdinalIgnoreCase);

    /// <summary>Longest status code the storage columns accept (`DEPHD-VDR` is 9).</summary>
    public const int MaxCodeLength = 10;

    /// <summary>Statuses from which the vendor can (re)submit the registration for review.</summary>
    public static bool IsSubmittableFrom(string status) =>
        status is Invited or Responded or Draft or Repair;

    /// <summary>Statuses from which a vendor can be blacklisted.</summary>
    public static bool IsBlacklistableFrom(string status) =>
        status is Approved or Registered;
}
