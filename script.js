// script.js
    // Load worker address from localStorage if available
    window.addEventListener('DOMContentLoaded', () => {
      const savedWorker = localStorage.getItem("workerAddress");
      if (savedWorker) {
        document.getElementById("workerInput").value = savedWorker;
      }
    });

    let lastNetworkDiffFetch = 0;
    let cachedNetworkDiff = null;
    let lastWorkerFetch = 0;
    let cachedWorkerData = null;
    let cachedWorkerAddress = null;

    async function getNetworkDiff() {
      const url = 'https://blockchain.info/q/getdifficulty?cors=true';
      const now = Date.now();
      // Only fetch if more than 60 seconds have passed since last fetch
      if (cachedNetworkDiff !== null && (now - lastNetworkDiffFetch) < 60000) {
        return cachedNetworkDiff;
      }
      try {
        const res = await fetch(url);
        const text = await res.text();
        const diff = parseFloat(text);
        cachedNetworkDiff = diff;
        lastNetworkDiffFetch = now;
        return diff;
      } catch (err) {
        console.error("Error fetching network difficulty from blockchain.info:", err);
        return cachedNetworkDiff; // fallback to last value if available
      }
    }

    async function getWorkerData(workerAddress) {
      const now = Date.now();
      // Only fetch if more than 60 seconds have passed and address is the same
      if (
        cachedWorkerData !== null &&
        cachedWorkerAddress === workerAddress &&
        (now - lastWorkerFetch) < 60000
      ) {
        return cachedWorkerData;
      }
      const url = 'https://eusolo.ckpool.org/users/' + encodeURIComponent(workerAddress);
      const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
      try {
        const res = await fetch(proxyUrl);
        const text = await res.text();
        // Extract JSON data from HTML
        const jsonMatch = text.match(/{[\s\S]*"workername"[\s\S]*}/);
        if (!jsonMatch) throw new Error('No JSON data found');
        const data = JSON.parse(jsonMatch[0]);
        cachedWorkerData = data;
        cachedWorkerAddress = workerAddress;
        lastWorkerFetch = now;
        return data;
      } catch (err) {
        console.error("Error fetching worker data:", err);
        return null;
      }
    }

    // Save worker address to localStorage on update
    async function updateData() {
      // Get worker address from input
      const workerAddress = document.getElementById("workerInput").value.trim();
      localStorage.setItem("workerAddress", workerAddress);

      try {
        // Fetch network difficulty
        const networkDiff = await getNetworkDiff();

        // Fetch worker data (with rate limit)
        const data = await getWorkerData(workerAddress);
        if (!data) throw new Error('No JSON data found');
        const worker = data.worker[0];

        document.getElementById("worker").textContent = worker.workername;
        document.getElementById("lastshare").textContent = worker.lastshare;
        document.getElementById("shares").textContent = worker.shares;
        document.getElementById("bestEver").textContent = worker.bestever;

        document.getElementById("hashrate1m").textContent = parseFloat(worker.hashrate1m) + " TH/s";
        document.getElementById("hashrate5m").textContent = parseFloat(worker.hashrate5m) + " TH/s";
        document.getElementById("hashrate1hr").textContent = parseFloat(worker.hashrate1hr) + " TH/s";
        document.getElementById("hashrate1d").textContent = parseFloat(worker.hashrate1d) + " TH/s";
        document.getElementById("hashrate7d").textContent = parseFloat(worker.hashrate7d) + " TH/s";

        const bestShareT = worker.bestshare / 1e12;
        document.getElementById("bestShare").textContent = bestShareT.toFixed(6) + " T";

        const bestEverT = worker.bestever / 1e12;
        document.getElementById("bestEver").textContent = bestEverT.toFixed(6) + " T";

        const networkDiffT = networkDiff / 1e12;
        document.getElementById("networkDiff").textContent = networkDiffT ? networkDiffT.toFixed(2) + " T" : "–";

        // Progress bar calculation
        const percent = networkDiff ? (bestShareT / networkDiffT) * 100 : 0;
        const bar = document.getElementById("progressBar");
        bar.style.width = Math.min(percent, 100) + "%";
        bar.className = "bar " + (percent >= 100 ? "green" : percent >= 75 ? "yellow" : "red");

        document.getElementById("percent").textContent = "Best Shot in percent: " + percent.toFixed(5) + " %";

        // Odds of Finding a Block calculation
        function odds(myHashrateTH, networkDiff, days) {
          const myHashrate = myHashrateTH * 1e12; // in H/s
          const networkHashrate = networkDiff * Math.pow(2, 32) / 600;
          const pPerBlock = myHashrate / networkHashrate;
          const blocks = days * 144; // ~144 blocks/day
          const pTotal = 1 - Math.pow(1 - pPerBlock, blocks);
          const percent = pTotal * 100;
          let percentStr = percent.toFixed(3) + " %";
          let oneInStr = percent > 0 ? "1:" + Math.round(100 / percent) : "–";
          return { percentStr, oneInStr };
        }

        // 1 Day: 1d hashrate
        let dayOdds = odds(parseFloat(worker.hashrate1d), networkDiff, 1);
        let weekOdds = odds(parseFloat(worker.hashrate1d), networkDiff, 7);
        let monthOdds = odds(parseFloat(worker.hashrate1d), networkDiff, 30);
        let yearOdds = odds(parseFloat(worker.hashrate1d), networkDiff, 365);

        document.getElementById("oddsDayPercent").textContent = dayOdds.percentStr;
        document.getElementById("oddsDayChance").textContent = dayOdds.oneInStr;
        document.getElementById("oddsWeekPercent").textContent = weekOdds.percentStr;
        document.getElementById("oddsWeekChance").textContent = weekOdds.oneInStr;
        document.getElementById("oddsMonthPercent").textContent = monthOdds.percentStr;
        document.getElementById("oddsMonthChance").textContent = monthOdds.oneInStr;
        document.getElementById("oddsYearPercent").textContent = yearOdds.percentStr;
        document.getElementById("oddsYearChance").textContent = yearOdds.oneInStr;

        // Open "Shares" and "Odds of Finding a Block" details after update
        document.querySelectorAll('.card details').forEach(details => {
          const summaryText = details.querySelector('summary')?.textContent?.toLowerCase();
          if (summaryText && (summaryText.includes('shares') || summaryText.includes('odds'))) {
            details.open = true;
          }
        });

      } catch (err) {
        console.error("Error loading data:", err);
        // Show error message in the dashboard
        document.getElementById("worker").textContent = "Invalid or not found!";
        document.getElementById("lastshare").textContent = "–";
        document.getElementById("shares").textContent = "–";
        document.getElementById("bestShare").textContent = "–";
        document.getElementById("bestEver").textContent = "–";
        document.getElementById("networkDiff").textContent = "–";
        document.getElementById("hashrate1m").textContent = "–";
        document.getElementById("hashrate5m").textContent = "–";
        document.getElementById("hashrate1hr").textContent = "–";
        document.getElementById("hashrate1d").textContent = "–";
        document.getElementById("hashrate7d").textContent = "–";
        document.getElementById("progressBar").style.width = "0%";
        document.getElementById("percent").textContent = "Best Shot in percent: –";
        document.getElementById("oddsDayPercent").textContent = "<0.001%";
        document.getElementById("oddsDayChance").textContent = "<1:1000";
        document.getElementById("oddsWeekPercent").textContent = "<0.001%";
        document.getElementById("oddsWeekChance").textContent = "<1:1000";
        document.getElementById("oddsMonthPercent").textContent = "<0.001%";
        document.getElementById("oddsMonthChance").textContent = "<1:1000";
        document.getElementById("oddsYearPercent").textContent = "<0.001%";
        document.getElementById("oddsYearChance").textContent = "<1:1000";
      }
    }

    document.getElementById('updateBtn').onclick = updateData;
    document.getElementById('workerInput').onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateData();
      }
    };
