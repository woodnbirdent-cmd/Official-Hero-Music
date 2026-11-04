const TYPES = [
  { value: "", label: "All types" },
  { value: "merch", label: "Merch" },
  { value: "feature-verse", label: "Feature verse" },
  { value: "playlist", label: "Playlist" },
  { value: "other", label: "Other" },
];

export default function OrderFilters({
  action,
  type,
  query,
}: {
  action: string;
  type: string;
  query: string;
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
      <label className="block">
        <span className="section-label mb-2 block">Type</span>
        <select name="type" defaultValue={type} className="input-field">
          {TYPES.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="section-label mb-2 block">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Name, email, item, size, song"
          className="input-field"
          maxLength={100}
        />
      </label>
      <button type="submit" className="btn-primary">
        Apply
      </button>
    </form>
  );
}
