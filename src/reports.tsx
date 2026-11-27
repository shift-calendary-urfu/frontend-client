import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type CalendarReport, type Workplace } from "./api";
import { canManageEmployees } from "./employees";
import {
  Empty,
  LoadState,
  MarketBadge,
  WorkplacePicker,
  positiveId,
  useMutation,
  useResource,
} from "./management-ui";
import {
  calendarPath,
  dateString,
  monthLabel,
  moveMonth,
  timeLabel,
  validMonth,
} from "./calendar-utils";
import { Notice } from "./ui";

export function reportPath(workplaceId: number, month?: string) {
  const query = new URLSearchParams({ workplace: String(workplaceId) });
  if (month) query.set("month", month);
  return `/reports/monthly?${query}`;
}

function validReportMonth(month: string) {
  return validMonth(month) && month >= "2000-01" && month <= "2100-12";
}

const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const periodError = "Выберите месяц с января 2000 по декабрь 2100 года.";

export function MonthlyReports() {
  const [search, setSearch] = useSearchParams();
  const points = useResource("report-workplaces", async () => {
    const [items, me] = await Promise.all([api.workplaces.list(), api.me()]);
    return { items, me };
  });
  const rawPoint = search.get("workplace");
  const pointId =
    rawPoint === null ? points.data?.items[0]?.id : positiveId(rawPoint);
  const point = points.data?.items.find((item) => item.id === pointId);
  const detail = useResource(`report-workplace-${point?.id || "none"}`, () =>
    point ? api.workplaces.get(point.id) : Promise.resolve(null),
  );
  const period = search.get("month");
  const currentMonth = dateString(new Date()).slice(0, 7);
  const backMonth = period && validReportMonth(period) ? period : currentMonth;
  const canView =
    !!detail.data &&
    !!points.data &&
    canManageEmployees(detail.data, points.data.me.id, detail.data.employees);

  return (
    <main className="page workspace-page reports-page">
      <Link
        className="back"
        to={point ? calendarPath(point.id, backMonth) : "/calendar"}
      >
        К календарю
      </Link>
      <header className="report-heading">
        <h1>Отчёт по сменам</h1>
        <p>Часы и смены сотрудников за месяц</p>
      </header>
      <LoadState {...points} />
      {points.data &&
        (points.data.items.length ? (
          <>
            <section className="report-workplace" aria-label="Рабочая точка для отчёта">
              {point && (
                <Link
                  to={`/workplaces/${point.id}`}
                  className="report-workplace-info"
                >
                  <MarketBadge type={point.workplace_type} />
                  <span>
                    <strong>{point.name}</strong>
                    {point.address && <span>{point.address}</span>}
                  </span>
                </Link>
              )}
              <WorkplacePicker
                points={points.data.items}
                selected={point?.id}
                change={(id) => setSearch({ workplace: id })}
              />
            </section>
            {!point ? (
              <Notice
                text="Эта точка недоступна. Выберите точку из списка."
                error
              />
            ) : (
              <>
                <LoadState {...detail} />
                {detail.data &&
                  (canView ? (
                    <ReportForm
                      key={`${point.id}-${period ?? "draft"}`}
                      point={detail.data}
                      initialPeriod={period}
                      apply={(month) =>
                        setSearch({ workplace: String(point.id), month })
                      }
                    />
                  ) : (
                    <Notice text="Отчёт по точке доступен владельцу и активному администратору этой точки." />
                  ))}
              </>
            )}
          </>
        ) : (
          <Empty>
            <p>Нет доступных точек</p>
            <Link className="primary button-link" to="/workplaces">
              Открыть список точек
            </Link>
          </Empty>
        ))}
    </main>
  );
}

function ReportForm({
  point,
  initialPeriod,
  apply,
}: {
  point: Workplace;
  initialPeriod: string | null;
  apply: (month: string) => void;
}) {
  const currentMonth = dateString(new Date()).slice(0, 7);
  const [month, setMonth] = useState(initialPeriod ?? currentMonth);
  const [validation, setValidation] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const action = useMutation();
  const submitted = initialPeriod === month && validReportMonth(month);
  const report = useResource(
    `report-${point.id}-${submitted ? month : "draft"}`,
    async () => {
      if (!submitted) return null;
      const result = await api.reports.calendar(point.id, month);
      if (result.workplace_id !== point.id || result.period !== month)
        throw new Error(
          "Не удалось получить отчёт за выбранный месяц. Попробуйте снова.",
        );
      return result;
    },
  );
  const previousMonth = moveMonth(currentMonth, -1);
  const busy = submitted && report.loading;
  const error =
    validation ||
    (initialPeriod !== null && !validReportMonth(month) ? periodError : "");

  function changeMonth(value: string) {
    setMonth(value);
    setValidation("");
    setDownloaded(false);
    action.setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || action.busy) return;
    if (!validReportMonth(month)) {
      setValidation(periodError);
      return;
    }
    setDownloaded(false);
    action.setError("");
    if (submitted) report.retry();
    else apply(month);
  }
  function download() {
    if (!report.data || busy) return;
    setDownloaded(false);
    void action.run(
      () => api.reports.excel(point.id, month),
      (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `report_${point.id}_${month}.xlsx`;
        try {
          document.body.append(link);
          link.click();
          setDownloaded(true);
        } finally {
          link.remove();
          // Leave time for the browser to start reading the download.
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
    );
  }

  return (
    <>
      <form className="report-filters" onSubmit={submit} noValidate>
        <fieldset disabled={action.busy}>
          <label className="field report-period">
            <span>Месяц отчёта</span>
            <input
              type="month"
              name="month"
              min="2000-01"
              max="2100-12"
              required
              value={month}
              onChange={(event) => changeMonth(event.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "report-period-error" : undefined}
            />
          </label>
          <div className="report-presets" aria-label="Быстрый выбор периода">
            <button
              type="button"
              aria-pressed={month === currentMonth}
              onClick={() => changeMonth(currentMonth)}
            >
              Этот месяц
            </button>
            {previousMonth && validReportMonth(previousMonth) && (
              <button
                type="button"
                aria-pressed={month === previousMonth}
                onClick={() => changeMonth(previousMonth)}
              >
                Прошлый месяц
              </button>
            )}
          </div>
          {error && (
            <p id="report-period-error" className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy
              ? "Формируем…"
              : report.data
                ? "Обновить отчёт"
                : "Сформировать отчёт"}
          </button>
        </fieldset>
      </form>
      {submitted && (
        <>
          {report.loading && (
            <p className="loading" role="status">
              Формируем отчёт…
            </p>
          )}
          {report.error && <Notice text={report.error} error />}
          {report.data && (
            <ReportResult
              report={report.data}
              point={point}
              downloading={action.busy}
              downloadError={action.error}
              downloaded={downloaded}
              download={download}
            />
          )}
        </>
      )}
    </>
  );
}

function ReportResult({
  report,
  point,
  downloading,
  downloadError,
  downloaded,
  download,
}: {
  report: CalendarReport;
  point: Workplace;
  downloading: boolean;
  downloadError: string;
  downloaded: boolean;
  download: () => void;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "nearest" });
  }, [report]);
  const fullShifts = report.employees.reduce(
    (sum, item) => sum + item.full_shifts_count,
    0,
  );
  return (
    <section className="report-result" aria-labelledby={titleId}>
      <header className="report-result-heading">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {monthLabel(report.period)}
        </h2>
        <button
          className="report-download"
          type="button"
          disabled={downloading}
          onClick={download}
        >
          {downloading ? "Скачиваем…" : "Скачать Excel"}
        </button>
      </header>
      <Notice text={downloadError} error />
      <Notice
        text={downloaded ? "Excel-файл передан браузеру для скачивания." : ""}
      />
      <dl className="report-totals">
        <div>
          <dt>Всего часов</dt>
          <dd>{number.format(report.total_hours)}</dd>
        </div>
        <div>
          <dt>Всего смен</dt>
          <dd>{number.format(report.total_shifts)}</dd>
        </div>
        <div>
          <dt>Полных смен</dt>
          <dd>{number.format(fullShifts)}</dd>
        </div>
      </dl>
      {report.total_shifts === 0 && (
        <p className="report-empty">За этот месяц смен нет.</p>
      )}
      {report.employees.length ? (
        <table className="report-table">
          <caption>По сотрудникам</caption>
          <thead>
            <tr>
              <th scope="col">Сотрудник</th>
              <th scope="col">Всего часов</th>
              <th scope="col">Полных смен</th>
              <th scope="col">Часов в полных сменах</th>
            </tr>
          </thead>
          <tbody>
            {report.employees.map((item) => (
              <tr key={item.employee_id}>
                <th scope="row">{item.full_name}</th>
                <td>
                  <span aria-hidden="true">Всего часов</span>
                  {number.format(item.hours_worked)}
                </td>
                <td>
                  <span aria-hidden="true">Полных смен</span>
                  {number.format(item.full_shifts_count)}
                </td>
                <td>
                  <span aria-hidden="true">Часов в полных сменах</span>
                  {number.format(item.full_shifts_hours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="report-empty">
          В этой точке пока нет сотрудников для отчёта.
        </p>
      )}
      <details className="report-explanation">
        <summary>Как считаются показатели</summary>
        <p>
          Отчёт составлен по актуальному расписанию. Отменённые и удалённые
          смены исключены.
        </p>
        <p>
          Полная смена покрывает весь рабочий день точки — с{" "}
          {timeLabel(point.work_start_time)} до {timeLabel(point.work_end_time)}
          . В часы входит вся длительность смены.
        </p>
        <p>
          Сотрудники без смен показаны с нулевыми значениями. Смены бывших
          сотрудников за этот месяц тоже учитываются.
        </p>
      </details>
    </section>
  );
}
