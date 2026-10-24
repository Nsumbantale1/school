export function CourseAnalysis({
  passMark,
  trend,
  danger,
  ceased,
}: {
  passMark: number;
  trend: { label: string; average: number | null; fails: number; sat: number }[];
  danger: { name: string; armyNumber: string }[];
  ceased: { name: string; armyNumber: string }[];
}) {
  const sat = trend.filter((column) => column.average != null);
  const previous = sat.length >= 2 ? sat[sat.length - 2] : null;
  const latest = sat.length >= 1 ? sat[sat.length - 1] : null;
  let movement = "No exams have been recorded yet.";
  if (latest && previous && latest.average != null && previous.average != null) {
    const delta = latest.average - previous.average;
    const direction = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "steady";
    movement = `Class average moved from ${previous.average.toFixed(1)}% on test ${previous.label} to ${latest.average.toFixed(1)}% on test ${latest.label}. The course trend is ${direction}.`;
  } else if (latest?.average != null) {
    movement = `The first recorded class average is ${latest.average.toFixed(1)}% on test ${latest.label}.`;
  }

  return (
    <section className="space-y-4 print:hidden">
      <div className="border-b border-[#ddd6c6] pb-2 dark:border-border">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c6b5c] dark:text-muted-foreground">
          Course analysis
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pass mark is {passMark}%. A mark below that is a fail and shows in red.
        </p>
      </div>
      <p className="text-sm">{movement}</p>
      {sat.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="border-b px-2 py-1 font-medium">Test</th>
                {sat.map((column) => (
                  <th key={column.label} className="border-b px-2 py-1 text-center font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1">Class average</td>
                {sat.map((column) => (
                  <td
                    key={column.label}
                    className={`px-2 py-1 text-center tabular-nums ${
                      column.average != null && column.average < passMark
                        ? "font-semibold text-red-700"
                        : ""
                    }`}
                  >
                    {column.average == null ? "—" : `${column.average.toFixed(1)}%`}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-1">Fails</td>
                {sat.map((column) => (
                  <td key={column.label} className="px-2 py-1 text-center tabular-nums">
                    {column.fails}/{column.sat}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Danger zone</p>
          <p className="mt-1">Two failed exams in a row, still short of cease training.</p>
          {danger.length === 0 ? (
            <p className="mt-2 text-amber-900/80">No one is in the danger zone.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {danger.map((student) => (
                <li key={student.armyNumber}>
                  {student.name} · {student.armyNumber}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Cease training — CT</p>
          <p className="mt-1">Three failed exams in a row. Status on the course list is CT.</p>
          {ceased.length === 0 ? (
            <p className="mt-2 text-red-900/80">No one has ceased training on these tests.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {ceased.map((student) => (
                <li key={student.armyNumber}>
                  {student.name} · {student.armyNumber} · CT
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
