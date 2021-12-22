let myChart;
document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById("myChart").getContext("2d");
  const skipped = (ctx, value) =>
    ctx.p0.skip || ctx.p1.skip ? value : undefined;
  const down = (ctx, value) =>
    ctx.p0.parsed.y > ctx.p1.parsed.y ? value : undefined;

  const genericOptions = {
    fill: false,
    interaction: {
      intersect: false,
    },
    radius: 0,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };
  const config = {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "My First Dataset",
          data: [],
          borderColor: "#3385ff",
          segment: {
            borderColor: (ctx) =>
              skipped(ctx, "rgb(0,0,0,0.2)") || down(ctx, "rgb(192,75,75)"),
            borderDash: (ctx) => skipped(ctx, [6, 6]),
          },
          spanGaps: true,
        },
      ],
    },
    options: genericOptions,
  };

  myChart = new Chart(ctx, config);
});
