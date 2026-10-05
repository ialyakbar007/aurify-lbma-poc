import { useEffect, useState } from "react";



import {

  LineChart,

  Line,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  ResponsiveContainer,

} from "recharts";



import "./App.css";




const API_BASE = "http://localhost:5000/api/lbma";


/* =========================================================

   FIXING SCHEDULE

   London:

   AM fixing window  -> 10:35

   PM fixing window  -> 15:05



   UAE times automatically follow UK daylight-saving changes.

\========================================================= */



const LONDON_TIME_ZONE = "Europe/London";

const UAE_TIME_ZONE = "Asia/Dubai";



function getLondonParts(date = new Date()) {

  const formatter = new Intl.DateTimeFormat("en-GB", {

    timeZone: LONDON_TIME_ZONE,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hourCycle: "h23",

  });



  const parts = formatter.formatToParts(date);



  const result = {};



  parts.forEach((part) => {

    if (part.type !== "literal") {

      result[part.type] = Number(part.value);

    }

  });



  return result;

}



function getLondonOffset(date) {

  const formatter = new Intl.DateTimeFormat("en-US", {

    timeZone: LONDON_TIME_ZONE,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hourCycle: "h23",

  });



  const parts = formatter.formatToParts(date);



  const values = {};



  parts.forEach((part) => {

    if (part.type !== "literal") {

      values[part.type] = Number(part.value);

    }

  });



  const londonAsUTC = Date.UTC(

    values.year,

    values.month - 1,

    values.day,

    values.hour,

    values.minute,

    values.second

  );



  return londonAsUTC - date.getTime();

}



function createLondonDate(year, month, day, hour, minute) {

  const approximateUTC = new Date(

    Date.UTC(year, month - 1, day, hour, minute, 0)

  );



  const offset = getLondonOffset(approximateUTC);



  return new Date(

    Date.UTC(year, month - 1, day, hour, minute, 0) - offset

  );

}



function isWeekend(year, month, day) {

  const date = new Date(Date.UTC(year, month - 1, day));

  const dayOfWeek = date.getUTCDay();



  return dayOfWeek === 0 || dayOfWeek === 6;

}



function getNextFixing() {

  const now = new Date();

  const london = getLondonParts(now);



  let year = london.year;

  let month = london.month;

  let day = london.day;



  /* Today's AM fixing */

  let amTarget = createLondonDate(

    year,

    month,

    day,

    10,
    30

  );



  /* Today's PM fixing */

  let pmTarget = createLondonDate(

    year,

    month,

    day,

    15,
    0

  );



  /*

     Skip weekends.

     The production scheduler should additionally handle

     UK bank holidays when fetching the fixing.

  */

  if (!isWeekend(year, month, day)) {

    if (now < amTarget) {

      return {

        type: "AM",

        target: amTarget,

      };

    }



    if (now < pmTarget) {

      return {

        type: "PM",

        target: pmTarget,

      };

    }

  }



  /* Move to next weekday */

  const nextDay = new Date(

    Date.UTC(year, month - 1, day + 1)

  );



  while (

    isWeekend(

      nextDay.getUTCFullYear(),

      nextDay.getUTCMonth() + 1,

      nextDay.getUTCDate()

    )

  ) {

    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  }



  year = nextDay.getUTCFullYear();

  month = nextDay.getUTCMonth() + 1;

  day = nextDay.getUTCDate();



  return {

    type: "AM",

    target: createLondonDate(

      year,

      month,

      day,

      10,
    30

    ),

  };

}



function formatCountdown(milliseconds) {

  if (milliseconds <= 0) {

    return "00:00:00";

  }



  const totalSeconds = Math.floor(milliseconds / 1000);



  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor(

    (totalSeconds % 3600) / 60

  );

  const seconds = totalSeconds % 60;



  return [

    String(hours).padStart(2, "0"),

    String(minutes).padStart(2, "0"),

    String(seconds).padStart(2, "0"),

  ].join(":");

}



function formatLondonTime(date) {

  return new Intl.DateTimeFormat("en-GB", {

    timeZone: LONDON_TIME_ZONE,

    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",

  }).format(date);

}



function formatUaeTime(date) {

  return new Intl.DateTimeFormat("en-GB", {

    timeZone: UAE_TIME_ZONE,

    hour: "2-digit",

    minute: "2-digit",

    hourCycle: "h23",

  }).format(date);

}



/* =========================================================

   COUNTDOWN BADGE

\========================================================= */



function NextFixingBadge() {

  const [countdown, setCountdown] = useState({

    type: "AM",

    target: null,

    remaining: 0,

  });



  useEffect(() => {

    function updateCountdown() {

      const next = getNextFixing();

      const now = new Date();



      setCountdown({

        type: next.type,

        target: next.target,

        remaining: next.target.getTime() - now.getTime(),

      });

    }



    updateCountdown();



    const interval = setInterval(

      updateCountdown,

      1000

    );



    return () => clearInterval(interval);

  }, []);



  if (!countdown.target) {

    return null;

  }



  return (

    <div

      className="history-count"

      title={`Next ${countdown.type} fixing — London ${formatLondonTime(

        countdown.target

      )} / UAE ${formatUaeTime(countdown.target)}`}

      style={{

        display: "flex",

        alignItems: "center",

        gap: "7px",

        whiteSpace: "nowrap",

      }}

    >

      <span

        style={{

          color: "#8c7cff",

          fontSize: "8px",

        }}

      >

        ●

      </span>



      <span>

        NEXT {countdown.type} FIX ·{" "}

        {formatCountdown(countdown.remaining)}

      </span>

    </div>

  );

}



/* =========================================================

   MAIN APP

\========================================================= */



function App() {

  const [latest, setLatest] = useState(null);

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);



  /* =======================================================

     API

  ======================================================= */



  async function fetchData() {

    try {

      const [latestResponse, historyResponse] =

        await Promise.all([

          fetch(`${API_BASE}/latest`),

          fetch(`${API_BASE}/history`),

        ]);



      if (

        !latestResponse.ok ||

        !historyResponse.ok

      ) {

        throw new Error(

          "Failed to fetch LBMA data"

        );

      }



      const latestData =

        await latestResponse.json();



      const historyData =

        await historyResponse.json();



      setLatest(latestData);



      const formattedHistory =

        Array.isArray(historyData)

          ? historyData

              .filter(

                (item) =>

                  item.am_usd_oz !== null ||

                  item.pm_usd_oz !== null

              )

              .sort(

                (a, b) =>

                  new Date(a.date) -

                  new Date(b.date)

              )

              .map((item) => ({

                ...item,



                am_usd_oz:

                  item.am_usd_oz !== null

                    ? Number(item.am_usd_oz)

                    : null,



                pm_usd_oz:

                  item.pm_usd_oz !== null

                    ? Number(item.pm_usd_oz)

                    : null,

              }))

          : [];



      setHistory(formattedHistory);

      setError(null);

    } catch (err) {

      console.error(err);

      setError(

        "Unable to connect to LBMA API"

      );

    } finally {

      setLoading(false);

    }

  }



  /* =======================================================

     FETCH DATA EVERY 60 SECONDS

  ======================================================= */



  useEffect(() => {

    fetchData();



    const interval = setInterval(

      fetchData,

      60000

    );



    return () =>

      clearInterval(interval);

  }, []);



  /* =======================================================

     FORMATTERS

  ======================================================= */



 function isValidPrice(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return false;
    }

    return Number.isFinite(
        Number(value)
    );
}


function formatPrice(value) {

    if (!isValidPrice(value)) {
        return "Not Published";
    }

    return `$${Number(value).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    )}`;
}


function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "2-digit",
            year: "numeric",
            timeZone: "Asia/Dubai"
        }
    );
}

  function formatChartDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            timeZone: "Asia/Dubai"
        }
    );
}


  /* =======================================================

     PUBLICATION STATUS

  ======================================================= */



  const amPublished =

    latest?.am_usd_oz !== null &&

    latest?.am_usd_oz !== undefined;



  const pmPublished =

    latest?.pm_usd_oz !== null &&

    latest?.pm_usd_oz !== undefined;



  /* =======================================================

     AM → PM DIFFERENCE

  ======================================================= */



  const amPrice = amPublished

    ? Number(latest.am_usd_oz)

    : null;



  const pmPrice = pmPublished

    ? Number(latest.pm_usd_oz)

    : null;



  const amPmDifference =

    amPrice !== null &&

    pmPrice !== null

      ? pmPrice - amPrice

      : null;



  /* =======================================================

     CHART DATA

  ======================================================= */



  const chartData = history.map(

    (item) => ({

      ...item,

      displayDate:

        formatChartDate(item.date),

    })

  );



  /* =======================================================

     LATEST 7 DAYS

  ======================================================= */



  const recentFixings = [...history]

    .slice(-7)

    .reverse();



  return (

    <div className="app">



      {/* ===================================================

          SIDEBAR

      =================================================== */}



      <aside className="sidebar">



        <div className="brand">



          <div className="brand-logo">

            A

          </div>



          <div>

            <div className="brand-name">

              Aurify IQ

            </div>



            <div className="brand-subtitle">

              ANALYTICS DASHBOARD

            </div>

          </div>



        </div>



        <div className="nav-section">



          <div className="nav-title">

            OVERVIEW

          </div>



          <div className="nav-item">

            <span>▦</span>

            Dashboard

          </div>



        </div>



        <div className="nav-section">



          <div className="nav-title">

            COMMERCIAL

          </div>



          <div className="nav-item">

            <span>◎</span>

            Lead Acquisition

          </div>



          <div className="nav-item">

            <span>♙</span>

            Customer Intelligence

          </div>



          <div className="nav-item">

            <span>⌁</span>

            Sales Pipeline

          </div>



        </div>



        <div className="nav-section">



          <div className="nav-title">

            BENCHMARKING

          </div>



          <div className="nav-item active">

            <span>◉</span>

            Fixing & Benchmarking

          </div>



        </div>



        <div className="nav-section">



          <div className="nav-title">

            PERFORMANCE

          </div>



          <div className="nav-item">

            <span>▥</span>

            Revenue Analytics

          </div>



          <div className="nav-item">

            <span>♙</span>

            Team Performance

          </div>



          <div className="nav-item">

            <span>◌</span>

            Strategic Forecast

          </div>



        </div>



        <div className="sidebar-bottom">



          <div className="nav-item">

            ⚙ Workspace Settings

          </div>



          <div className="workspace">



            <div className="workspace-icon">

              LB

            </div>



            <div>

              <strong>

                LBMA POC

              </strong>



              <small>

                Automated Fixing Data

              </small>

            </div>



            <span className="online"></span>



          </div>



        </div>



      </aside>



      {/* ===================================================

          MAIN

      =================================================== */}



      <main className="main">



        {/* HEADER */}



        <header className="topbar">



          <div>



            <div className="eyebrow">

              COMMERCIAL

            </div>



            <h1>

              Fixing & Benchmarking

            </h1>



            <p>

              London Gold Fixing — USD / oz

            </p>



          </div>



          <div className="topbar-actions">



            <div className="automated-status">

              <span></span>

              Automated Data

            </div>



            <div className="today">

              {latest

                ? formatDate(latest.date)

                : "Loading..."}

            </div>



            <button

              className="icon-button"

              onClick={fetchData}

              title="Refresh data"

            >

              ↻

            </button>



            <button

              className="icon-button"

              title="Settings"

            >

              ⚙

            </button>



          </div>



        </header>



        {/* ERROR */}



        {error && (

          <div className="error">

            {error}

          </div>

        )}



        {/* LOADING */}



        {loading && !latest && (

          <div className="loading">

            Loading LBMA fixing data...

          </div>

        )}



        {latest && (

          <>



            {/* =================================================

                KPI CARDS

            ================================================= */}



            <section className="kpi-grid">



              {/* AM */}



              <div

                className={`kpi-card ${

                  !amPublished

                    ? "pending-card"

                    : ""

                }`}

              >



                <div className="kpi-header">



                  <span>

                    AM FIX

                  </span>



                  <div

                    className={`kpi-badge ${

                      amPublished

                        ? "am"

                        : "pending-badge"

                    }`}

                  >

                    AM

                  </div>



                </div>



                <div className="kpi-status-row">



                  <span

                    className={`publish-badge ${

                      amPublished

                        ? "published"

                        : "pending"

                    }`}

                  >

                    {amPublished

                      ? "● PUBLISHED"

                      : "● PENDING"}

                  </span>



                </div>



                <div className="kpi-value">



                  {amPublished

                    ? formatPrice(amPrice)

                    : "Not Published"}



                </div>



                <div className="kpi-description">



                  {amPublished

                    ? "London morning fixing"

                    : "Waiting for AM fixing"}



                </div>



              </div>



              {/* PM */}



              <div

                className={`kpi-card ${

                  !pmPublished

                    ? "pending-card"

                    : ""

                }`}

              >



                <div className="kpi-header">



                  <span>

                    PM FIX

                  </span>



                  <div

                    className={`kpi-badge ${

                      pmPublished

                        ? "pm"

                        : "pending-badge"

                    }`}

                  >

                    PM

                  </div>



                </div>



                <div className="kpi-status-row">



                  <span

                    className={`publish-badge ${

                      pmPublished

                        ? "published"

                        : "pending"

                    }`}

                  >

                    {pmPublished

                      ? "● PUBLISHED"

                      : "● PENDING"}

                  </span>



                </div>



                <div className="kpi-value">



                  {pmPublished

                    ? formatPrice(pmPrice)

                    : "Not Published"}



                </div>



                <div className="kpi-description">



                  {pmPublished

                    ? "London afternoon fixing"

                    : "Waiting for PM fixing"}



                </div>



              </div>



              {/* AM → PM */}



              <div className="kpi-card">



                <div className="kpi-header">



                  <span>

                    AM → PM

                  </span>



                  <div className="kpi-badge delta">

                    Δ

                  </div>



                </div>



                <div

                  className={`kpi-value ${

                    amPmDifference !== null &&

                    amPmDifference < 0

                      ? "negative"

                      : "positive"

                  }`}

                >



                  {amPmDifference !== null

                    ? `${

                        amPmDifference >= 0

                          ? "+"

                          : ""

                      }$${amPmDifference.toFixed(

                        2

                      )}`

                    : "Waiting"}



                </div>



                <div className="kpi-description">



                  {amPmDifference !== null

                    ? "Same-day fixing movement"

                    : "Available after PM fixing"}



                </div>



              </div>



              {/* DATE */}



              <div className="kpi-card">



                <div className="kpi-header">



                  <span>

                    FIXING DATE

                  </span>



                  <div className="kpi-badge date">

                    •

                  </div>



                </div>



                <div className="kpi-date">



                  {formatDate(

                    latest.date

                  )}



                </div>



                <div className="kpi-description">

                  Latest available fixing

                </div>



              </div>



            </section>



            {/* =================================================

                CHART

            ================================================= */}



            <section className="panel chart-panel">



              <div className="panel-header">



                <div>



                  <div className="panel-eyebrow">

                    LBMA BENCHMARK

                  </div>



                  <h2>

                    Gold AM & PM Fix History

                  </h2>



                  <p>

                    Historical London Gold Fixing

                    prices in USD per troy ounce

                  </p>



                </div>



                <div className="history-badge">

                  Historical

                </div>



              </div>



              <div className="chart-container">



                {chartData.length > 0 ? (



                  <ResponsiveContainer

                    width="100%"

                    height={380}

                  >



                    <LineChart

                      data={chartData}

                      margin={{

                        top: 20,

                        right: 20,

                        left: 10,

                        bottom: 10,

                      }}

                    >



                      <CartesianGrid

                        strokeDasharray="3 3"

                        stroke="#253047"

                      />



                      <XAxis

                        dataKey="displayDate"

                        tick={{

                          fill: "#7f8ca8",

                          fontSize: 11,

                        }}

                        axisLine={{

                          stroke: "#344057",

                        }}

                        tickLine={false}

                      />



                      <YAxis

                        domain={[

                          "auto",

                          "auto",

                        ]}

                        tick={{

                          fill: "#7f8ca8",

                          fontSize: 11,

                        }}

                        axisLine={{

                          stroke: "#344057",

                        }}

                        tickLine={false}

                        tickFormatter={(value) =>

                          `$${Number(

                            value

                          ).toLocaleString()}`

                        }

                      />



                      <Tooltip

                        contentStyle={{

                          background:

                            "#111a2b",

                          border:

                            "1px solid #293653",

                          borderRadius:

                            "10px",

                          color: "#ffffff",

                        }}

                        labelStyle={{

                          color:

                            "#aeb9cf",

                          marginBottom:

                            "8px",

                        }}

                        formatter={(

                          value,

                          name

                        ) => [

                          formatPrice(value),

                          name ===

                          "am_usd_oz"

                            ? "AM Fixing"

                            : "PM Fixing",

                        ]}

                      />



                      <Line

                        type="monotone"

                        dataKey="am_usd_oz"

                        name="am_usd_oz"

                        stroke="#4d8dff"

                        strokeWidth={2.5}

                        dot={{

                          r: 3,

                          fill: "#4d8dff",

                        }}

                        activeDot={{

                          r: 6,

                        }}

                        connectNulls

                      />



                      <Line

                        type="monotone"

                        dataKey="pm_usd_oz"

                        name="pm_usd_oz"

                        stroke="#18c995"

                        strokeWidth={2.5}

                        dot={{

                          r: 3,

                          fill: "#18c995",

                        }}

                        activeDot={{

                          r: 6,

                        }}

                        connectNulls

                      />



                    </LineChart>



                  </ResponsiveContainer>



                ) : (



                  <div className="no-data">

                    No historical fixing data

                    available.

                  </div>



                )}



              </div>



              <div className="chart-legend">



                <div>

                  <span className="legend-dot am-dot"></span>

                  AM Fixing

                </div>



                <div>

                  <span className="legend-dot pm-dot"></span>

                  PM Fixing

                </div>



              </div>



            </section>



            {/* =================================================

                HISTORY TABLE

            ================================================= */}



            <section className="panel history-panel">



              <div className="panel-header">



                <div>



                  <div className="panel-eyebrow">

                    RECENT LBMA FIXINGS

                  </div>



                  <h2>

                    Last 7 Trading Days · Gold

                    AM & PM History

                  </h2>



                  <p>

                    Latest available fixing

                    observations

                  </p>



                </div>



                {/* COUNTDOWN */}



                <div

                  style={{

                    display: "flex",

                    alignItems: "center",

                    gap: "8px",

                  }}

                >



                  <NextFixingBadge />



                  <div className="history-count">

                    {Math.min(

                      history.length,

                      7

                    )}{" "}

                    DAYS

                  </div>



                </div>



              </div>



              <div className="table-wrapper">



                <table>



                  <thead>



                    <tr>



                      <th>

                        DATE

                      </th>



                      <th>

                        AM FIX

                      </th>



                      <th>

                        PM FIX

                      </th>



                      <th>

                        AM → PM

                      </th>



                      <th>

                        STATUS

                      </th>



                    </tr>



                  </thead>



                  <tbody>



                    {recentFixings.map(

                      (item) => {



                        const am = isValidPrice(
  item.am_usd_oz
)
  ? Number(item.am_usd_oz)
  : null;

const pm = isValidPrice(
  item.pm_usd_oz
)
  ? Number(item.pm_usd_oz)
  : null;


                        const difference =

                          am !== null &&

                          pm !== null

                            ? pm - am

                            : null;



                        const fullyPublished =

                          am !== null &&

                          pm !== null;



                        return (

                          <tr

                            key={

                              item.date

                            }

                          >



                            <td className="date-cell">

                              {formatDate(

                                item.date

                              )}

                            </td>



                            <td className="price-cell">

                              {formatPrice(

                                am

                              )}

                            </td>



                            <td className="price-cell">

                              {formatPrice(

                                pm

                              )}

                            </td>



                            <td>



                              {difference !==

                              null ? (



                                <span

                                  className={

                                    difference >=

                                    0

                                      ? "movement positive"

                                      : "movement negative"

                                  }

                                >



                                  {difference >=

                                  0

                                    ? "+"

                                    : ""}

                                  $

                                  {difference.toFixed(

                                    2

                                  )}



                                </span>



                              ) : (



                                <span className="waiting">

                                  Waiting

                                </span>



                              )}



                            </td>



                            <td>



                              <span

                                className={

                                  fullyPublished

                                    ? "published"

                                    : "table-pending"

                                }

                              >



                                {fullyPublished

                                  ? "● Published"

                                  : "● Pending"}



                              </span>



                            </td>



                          </tr>

                        );

                      }

                    )}



                  </tbody>



                </table>



              </div>



            </section>



            {/* =================================================

                SOURCE INFORMATION

            ================================================= */}



            <section className="source-panel">



              <div>



                <span>

                  DATA SOURCE

                </span>



                <strong>

                  {latest.source ||

                    "8853"}

                </strong>



              </div>
<div>



                <span>

                  UPDATE FREQUENCY

                </span>



                <strong>

                  Scheduled · AM / PM

                </strong>



              </div>



              <div>



                <span>

                  DATA TYPE

                </span>



                <strong>

                  Gold · USD / oz

                </strong>



              </div>



            </section>



          </>

        )}



      </main>



    </div>

  );

}



export default App;