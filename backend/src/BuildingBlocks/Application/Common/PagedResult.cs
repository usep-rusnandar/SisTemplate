namespace SisTemplate.BuildingBlocks.Application.Common;

public sealed record PageRequest(int Page = 1, int PageSize = 20)
{
    public int SafePage => Math.Max(1, Page);

    public int SafePageSize => Math.Clamp(PageSize, 1, 100);
}

public sealed record PagedResult<T>(
    IReadOnlyCollection<T> Items,
    int Page,
    int PageSize,
    int TotalItems)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling((double)TotalItems / PageSize);
}
