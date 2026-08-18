import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAWkHbWD-o9FMXqJtZ8dVdGvFMXf3lEZWM",
  authDomain: "lopi-sports.firebaseapp.com",
  projectId: "lopi-sports",
  storageBucket: "lopi-sports.firebasestorage.app",
  messagingSenderId: "938894851824",
  appId: "1:938894851824:web:f097c9ad6942218b094c35"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


/* =========================================================
   COLLECTIONS
   ========================================================= */

const COLLECTIONS = {
  teams: "tennisTeams",
  matches: "tennisMatches",
  settings: "tennisSettings"
};

const GROUPS = ["A", "B", "C", "D"];
const GROUP_TEAM_COUNT = 5;

const DEFAULT_TITLE = "REA Tennis Exhibition 2026";
const DEFAULT_SUBTITLE =
  "4 Groups × 5 Teams • Group Stage → Playoff";

let teams = [];
let matches = [];

let settings = {
  title: DEFAULT_TITLE,
  subtitle: DEFAULT_SUBTITLE
};

let removeMatchImage = false;


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) => document.getElementById(id);

const els = {
  title: $("tournamentTitle"),
  toast: $("toast"),

  dashboardStandings: $("dashboardStandings"),
  allStandings: $("allStandings"),

  latestResults: $("latestResults"),
  scheduleList: $("scheduleList"),

  playoffBracket: $("playoffBracket"),

  teamsGrid: $("teamsGrid"),

  statTeams: $("statTeams"),
  statGroupMatches: $("statGroupMatches"),
  statPlayoffMatches: $("statPlayoffMatches"),
  statCompleted: $("statCompleted")
};


/* =========================================================
   HELPERS
   ========================================================= */

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2600);
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateString) {
  if (!dateString) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(
    new Date(`${dateString}T00:00:00`)
  );
}


/* =========================================================
   TEAM HELPERS
   ========================================================= */

function teamById(id) {
  return teams.find(t => t.id === id);
}

function teamName(id) {
  const t = teamById(id);

  return t
    ? t.name
    : "TBD";
}

function teamPlayers(id) {
  const t = teamById(id);

  return t
    ? `${t.player1} / ${t.player2}`
    : "";
}


/* =========================================================
   IMAGE DISPLAY
   ========================================================= */

function avatarHtml(team, sizeClass = "") {

  if (!team) {
    return `
      <div class="team-avatar ${sizeClass}">
        ?
      </div>
    `;
  }

  if (team.imageUrl) {

    return `
      <img
        class="team-avatar ${sizeClass}"
        src="${escapeHtml(team.imageUrl)}"
        alt=""
      >
    `;
  }

  return `
    <div class="team-avatar ${sizeClass}">
      ${escapeHtml(
        (team.name || "?")
          .slice(0, 2)
          .toUpperCase()
      )}
    </div>
  `;
}


/* =========================================================
   IMAGE COMPRESSOR
   Firebase Storage TIDAK DIGUNAKAN
   ========================================================= */

/*
  Fungsi ini:

  1. Membaca file gambar
  2. Resize maksimal 1200 px
  3. Mengubah menjadi JPEG
  4. Compress quality 0.65
  5. Menghasilkan Data URL Base64

  Hasilnya akan disimpan ke Firestore
  pada field imageUrl.
*/

async function compressImage(
  file,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.65
) {

  if (!file) {
    throw new Error("File gambar tidak ditemukan.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error(
      "Ukuran gambar asli maksimal 10 MB."
    );
  }

  const dataUrl = await new Promise(
    (resolve, reject) => {

      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(
          new Error("Gagal membaca file gambar.")
        );
      };

      reader.readAsDataURL(file);
    }
  );


  const img = await new Promise(
    (resolve, reject) => {

      const image = new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error("Gagal memproses gambar.")
        );
      };

      image.src = dataUrl;
    }
  );


  let width = img.width;
  let height = img.height;


  /*
    Resize jika lebih besar
    dari 1200 x 1200
  */

  const ratio = Math.min(
    maxWidth / width,
    maxHeight / height,
    1
  );

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);


  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  /*
    Background putih agar gambar
    transparan tidak menjadi hitam
    ketika dikonversi ke JPEG.
  */

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.drawImage(
    img,
    0,
    0,
    width,
    height
  );


  let compressed = canvas.toDataURL(
    "image/jpeg",
    quality
  );


  /*
    Pastikan ukuran Base64
    tidak terlalu besar.

    Target sekitar < 700 KB.
  */

  let currentQuality = quality;

  while (
    compressed.length > 700000 &&
    currentQuality > 0.35
  ) {

    currentQuality -= 0.05;

    compressed = canvas.toDataURL(
      "image/jpeg",
      currentQuality
    );
  }


  /*
    Jika masih terlalu besar,
    resize lagi.
  */

  if (compressed.length > 850000) {

    const scale = 0.75;

    canvas.width = Math.round(
      canvas.width * scale
    );

    canvas.height = Math.round(
      canvas.height * scale
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    compressed = canvas.toDataURL(
      "image/jpeg",
      0.55
    );
  }


  /*
    Safety check.
  */

  if (compressed.length > 950000) {
    throw new Error(
      "Gambar masih terlalu besar setelah dikompresi. Silakan pilih foto lain."
    );
  }

  return compressed;
}


/* =========================================================
   PREVIEW IMAGE
   ========================================================= */

function previewSelectedImage(
  inputId,
  previewId,
  wrapperId = null
) {

  const input = $(inputId);

  if (!input) return;

  input.addEventListener(
    "change",
    async () => {

      const file = input.files[0];

      if (!file) return;

      try {

        const compressed =
          await compressImage(file);

        const preview =
          $(previewId);

        if (preview) {
          preview.src = compressed;
        }

        if (wrapperId) {
          $(wrapperId)
            ?.classList
            .remove("hidden");
        }

      } catch (error) {

        console.error(error);

        showToast(
          `Gagal memproses gambar: ${error.message}`
        );

        input.value = "";
      }
    }
  );
}


/* =========================================================
   SCORE
   ========================================================= */

function scoreArray(match, side) {

  const key =
    side === 1
      ? "scores1"
      : "scores2";

  return Array.isArray(match[key])
    ? match[key].map(Number)
    : [0, 0, 0];
}


function validScores(match) {

  const a = scoreArray(match, 1);
  const b = scoreArray(match, 2);

  return a.some(
    (v, i) =>
      v > 0 ||
      b[i] > 0
  );
}


function setWins(match, side) {

  const a = scoreArray(match, 1);
  const b = scoreArray(match, 2);

  let wins = 0;

  for (let i = 0; i < 3; i++) {

    if (a[i] === b[i]) continue;

    if (
      (side === 1 ? a[i] : b[i]) >
      (side === 1 ? b[i] : a[i])
    ) {
      wins++;
    }
  }

  return wins;
}


function winnerId(match) {

  if (!match || !validScores(match)) {
    return null;
  }

  const w1 = setWins(match, 1);
  const w2 = setWins(match, 2);

  if (w1 === w2) {
    return null;
  }

  return w1 > w2
    ? match.team1Id
    : match.team2Id;
}


function scoreDifferenceForMatch(
  match,
  teamId
) {

  const a = scoreArray(match, 1);
  const b = scoreArray(match, 2);

  if (
    match.team1Id !== teamId &&
    match.team2Id !== teamId
  ) {
    return 0;
  }

  const sign =
    match.team1Id === teamId
      ? 1
      : -1;

  let diff = 0;

  for (let i = 0; i < 3; i++) {
    diff +=
      (a[i] - b[i]) * sign;
  }

  return diff;
}


function totalScoreForMatch(
  match,
  teamId
) {

  const a = scoreArray(match, 1);
  const b = scoreArray(match, 2);

  if (
    match.team1Id !== teamId &&
    match.team2Id !== teamId
  ) {
    return 0;
  }

  const scores =
    match.team1Id === teamId
      ? a
      : b;

  return scores.reduce(
    (sum, n) =>
      sum + Number(n || 0),
    0
  );
}


function resultStatus(match) {
  return winnerId(match)
    ? "done"
    : "scheduled";
}


function isGroupMatch(match) {
  return match.stage === "group";
}


function isPlayoffMatch(match) {
  return match.stage === "playoff";
}


/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadData() {

  try {

    const [
      teamSnap,
      matchSnap,
      settingSnap
    ] = await Promise.all([

      getDocs(
        collection(
          db,
          COLLECTIONS.teams
        )
      ),

      getDocs(
        collection(
          db,
          COLLECTIONS.matches
        )
      ),

      getDoc(
        doc(
          db,
          COLLECTIONS.settings,
          "main"
        )
      )
    ]);


    teams = teamSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


    matches = matchSnap.docs.map(
      d => ({
        id: d.id,
        ...d.data()
      })
    );


    if (settingSnap.exists()) {

      settings = {
        ...settings,
        ...settingSnap.data()
      };
    }


    applySettings();
    renderAll();

  } catch (error) {

    console.error(error);

    showToast(
      `Firebase error: ${error.message}`
    );
  }
}


/* =========================================================
   SETTINGS
   ========================================================= */

function applySettings() {

  els.title.textContent =
    settings.title ||
    DEFAULT_TITLE;

  document.querySelector(
    ".subtitle"
  ).textContent =
    settings.subtitle ||
    DEFAULT_SUBTITLE;

  $("settingsTitle").value =
    settings.title ||
    DEFAULT_TITLE;

  $("settingsSubtitle").value =
    settings.subtitle ||
    DEFAULT_SUBTITLE;
}


/* =========================================================
   STANDINGS
   ========================================================= */

function calculateStandings(group) {

  const groupTeams =
    teams.filter(
      t => t.group === group
    );


  const table =
    groupTeams.map(team => ({

      teamId: team.id,

      played: 0,
      won: 0,
      lost: 0,

      points: 0,

      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0

    }));


  const map =
    new Map(
      table.map(
        row => [
          row.teamId,
          row
        ]
      )
    );


  matches
    .filter(
      m =>
        isGroupMatch(m) &&
        m.group === group &&
        winnerId(m)
    )
    .forEach(m => {

      const t1 =
        map.get(m.team1Id);

      const t2 =
        map.get(m.team2Id);

      if (!t1 || !t2) return;


      const winner =
        winnerId(m);

      t1.played++;
      t2.played++;


      const a =
        scoreArray(m, 1);

      const b =
        scoreArray(m, 2);


      const sf1 =
        a.reduce(
          (s, n) =>
            s + Number(n || 0),
          0
        );

      const sf2 =
        b.reduce(
          (s, n) =>
            s + Number(n || 0),
          0
        );


      t1.scoreFor += sf1;
      t1.scoreAgainst += sf2;

      t2.scoreFor += sf2;
      t2.scoreAgainst += sf1;


      if (winner === t1.teamId) {

        t1.won++;
        t1.points++;

        t2.lost++;

      } else {

        t2.won++;
        t2.points++;

        t1.lost++;
      }

    });


  table.forEach(
    r =>
      r.scoreDiff =
        r.scoreFor -
        r.scoreAgainst
  );


  /*
    Ranking:

    1. Point
    2. Score Difference
    3. Head-to-head
  */

  table.sort(
    (a, b) => {

      if (
        b.points !==
        a.points
      ) {
        return (
          b.points -
          a.points
        );
      }


      if (
        b.scoreDiff !==
        a.scoreDiff
      ) {
        return (
          b.scoreDiff -
          a.scoreDiff
        );
      }


      const h2h =
        headToHeadResult(
          group,
          a.teamId,
          b.teamId
        );

      if (h2h !== 0) {
        return h2h;
      }


      return a.teamId.localeCompare(
        b.teamId
      );
    }
  );


  return table;
}


function headToHeadResult(
  group,
  teamA,
  teamB
) {

  const direct =
    matches.filter(
      m =>

        isGroupMatch(m) &&
        m.group === group &&
        winnerId(m) &&

        (
          (
            m.team1Id === teamA &&
            m.team2Id === teamB
          )
          ||
          (
            m.team1Id === teamB &&
            m.team2Id === teamA
          )
        )
    );


  if (!direct.length) {
    return 0;
  }


  const winner =
    winnerId(direct[0]);


  if (winner === teamA) {
    return 1;
  }

  if (winner === teamB) {
    return -1;
  }

  return 0;
}


function qualifiedTeams() {

  const result = {};

  GROUPS.forEach(group => {

    const table =
      calculateStandings(group);

    result[group] = {

      champion:
        table[0]?.teamId ||
        null,

      runnerUp:
        table[1]?.teamId ||
        null
    };

  });

  return result;
}


/* =========================================================
   STANDINGS TABLE
   ========================================================= */

function standingsTable(
  group,
  compact = false
) {

  const table =
    calculateStandings(group);


  if (!table.length) {

    return `
      <div class="empty">
        Belum ada tim di Group ${group}.
      </div>
    `;
  }


  return `
    <div class="standings-card">

      <div class="standings-title">

        <h3>
          Group ${group}
        </h3>

        <small>
          Top 2 qualify
        </small>

      </div>


      <table>

        <thead>

          <tr>

            <th>#</th>
            <th>Team</th>

            <th class="num">P</th>
            <th class="num">W</th>
            <th class="num">L</th>
            <th class="num">Pts</th>
            <th class="num">SD</th>

          </tr>

        </thead>


        <tbody>

          ${table.map(
            (row, index) => {

              const team =
                teamById(
                  row.teamId
                );

              return `

                <tr
                  class="${
                    index < 2
                      ? "qualified-row"
                      : ""
                  }"
                >

                  <td class="rank">
                    ${index + 1}
                  </td>


                  <td>

                    <div class="team-cell">

                      ${avatarHtml(team)}

                      <span>
                        ${escapeHtml(
                          team?.name ||
                          "TBD"
                        )}
                      </span>

                    </div>

                  </td>


                  <td class="num">
                    ${row.played}
                  </td>

                  <td class="num">
                    ${row.won}
                  </td>

                  <td class="num">
                    ${row.lost}
                  </td>

                  <td class="num">

                    <strong>
                      ${row.points}
                    </strong>

                  </td>

                  <td class="num">

                    ${
                      row.scoreDiff > 0
                        ? "+"
                        : ""
                    }

                    ${row.scoreDiff}

                  </td>

                </tr>

              `;
            }
          ).join("")}

        </tbody>

      </table>

    </div>
  `;
}


function renderStandings() {

  els.allStandings.innerHTML =
    GROUPS
      .map(g =>
        standingsTable(g)
      )
      .join("");


  els.dashboardStandings.innerHTML =
    GROUPS
      .map(g =>
        standingsTable(
          g,
          true
        )
      )
      .join("");
}


/* =========================================================
   MATCH CARD
   ========================================================= */

function matchCard(match) {

  const t1 =
    teamById(match.team1Id);

  const t2 =
    teamById(match.team2Id);

  const winner =
    winnerId(match);

  const s1 =
    scoreArray(match, 1);

  const s2 =
    scoreArray(match, 2);


  const scoreText =
    (side) => {

      const scores =
        side === 1
          ? s1
          : s2;

      const opponent =
        side === 1
          ? s2
          : s1;


      return scores
        .filter(
          (n, i) =>
            n !== 0 ||
            opponent[i] !== 0
        )
        .join(" - ") ||
        "—";
    };


  const location =
    [
      formatDate(match.date),
      match.time,
      match.court
    ]
      .filter(Boolean)
      .join(" • ");


  return `

    <article class="match-card">

      <div class="match-meta">

        <strong>

          ${
            match.stage === "playoff"

              ? (
                match.round ||
                "Playoff"
              )

              : `Group ${
                  match.group || "-"
                }`
          }

        </strong>


        <span>
          ${escapeHtml(location)}
        </span>


        <div style="margin-top:7px">

          <span
            class="status ${
              winner
                ? "done"
                : ""
            }"
          >

            ${
              winner
                ? "Completed"
                : "Scheduled"
            }

          </span>

        </div>

      </div>


      <div class="match-teams">

        <div
          class="match-team ${
            winner === match.team1Id
              ? "winner"
              : ""
          }"
        >

          <span class="name">

            ${escapeHtml(
              t1?.name ||
              "TBD"
            )}

          </span>


          <span class="score">

            ${setWins(match, 1)}

            <small class="score-detail">

              ${scoreText(1)}

            </small>

          </span>

        </div>


        <div
          class="match-team ${
            winner === match.team2Id
              ? "winner"
              : ""
          }"
        >

          <span class="name">

            ${escapeHtml(
              t2?.name ||
              "TBD"
            )}

          </span>


          <span class="score">

            ${setWins(match, 2)}

            <small class="score-detail">

              ${scoreText(2)}

            </small>

          </span>

        </div>

      </div>


      ${
        match.imageUrl

          ? `

            <a
              class="photo-link"
              href="${escapeHtml(
                match.imageUrl
              )}"
              target="_blank"
              rel="noopener"
            >

              <img
                class="match-photo"
                src="${escapeHtml(
                  match.imageUrl
                )}"
                alt="Match result"
              >

            </a>

          `

          : `

            <div class="muted">
              No photo
            </div>

          `
      }

    </article>

  `;
}


/* =========================================================
   SCHEDULE
   ========================================================= */

function renderSchedule() {

  const stage =
    $("scheduleStage").value;

  const group =
    $("scheduleGroup").value;


  let filtered =
    [...matches];


  if (stage !== "all") {

    filtered =
      filtered.filter(
        m =>
          m.stage === stage
      );
  }


  if (group !== "all") {

    filtered =
      filtered.filter(
        m =>
          m.group === group
      );
  }


  filtered.sort(
    (a, b) => {

      const da =
        `${a.date || ""} ${
          a.time || ""
        }`;

      const db =
        `${b.date || ""} ${
          b.time || ""
        }`;

      return db.localeCompare(da);
    }
  );


  els.scheduleList.innerHTML =
    filtered.length

      ? filtered
          .map(matchCard)
          .join("")

      : `
        <div class="empty">
          Belum ada pertandingan.
        </div>
      `;
}


/* =========================================================
   LATEST RESULTS
   ========================================================= */

function renderLatestResults() {

  const results =
    [...matches]
      .filter(
        m => winnerId(m)
      )
      .sort(
        (a, b) =>
          `${b.date || ""} ${
            b.time || ""
          }`.localeCompare(
            `${a.date || ""} ${
              a.time || ""
            }`
          )
      )
      .slice(0, 7);


  els.latestResults.innerHTML =
    results.length

      ? results
          .map(matchCard)
          .join("")

      : `
        <div class="empty">
          Belum ada hasil pertandingan.
        </div>
      `;
}


/* =========================================================
   PLAYOFF
   ========================================================= */

function getPlayoffMatch(round) {

  return matches.find(
    m =>
      m.stage === "playoff" &&
      m.round === round
  );
}


function playoffTeamFor(
  round,
  side
) {

  const q =
    getPlayoffMatch(round);

  if (q) {

    return side === 1
      ? q.team1Id
      : q.team2Id;
  }


  const qual =
    qualifiedTeams();


  if (round === "QF1") {

    return side === 1
      ? qual.A.champion
      : qual.B.runnerUp;
  }


  if (round === "QF2") {

    return side === 1
      ? qual.C.champion
      : qual.D.runnerUp;
  }


  if (round === "QF3") {

    return side === 1
      ? qual.B.champion
      : qual.A.runnerUp;
  }


  if (round === "QF4") {

    return side === 1
      ? qual.D.champion
      : qual.C.runnerUp;
  }


  if (round === "SF1") {

    const qf1 =
      getPlayoffMatch("QF1");

    const qf2 =
      getPlayoffMatch("QF2");

    return side === 1
      ? winnerId(qf1 || {})
      : winnerId(qf2 || {});
  }


  if (round === "SF2") {

    const qf3 =
      getPlayoffMatch("QF3");

    const qf4 =
      getPlayoffMatch("QF4");

    return side === 1
      ? winnerId(qf3 || {})
      : winnerId(qf4 || {});
  }


  if (round === "Final") {

    const sf1 =
      getPlayoffMatch("SF1");

    const sf2 =
      getPlayoffMatch("SF2");

    return side === 1
      ? winnerId(sf1 || {})
      : winnerId(sf2 || {});
  }


  return null;
}


function bracketMatchHtml(
  round,
  label
) {

  const match =
    getPlayoffMatch(round);

  const team1 =
    playoffTeamFor(
      round,
      1
    );

  const team2 =
    playoffTeamFor(
      round,
      2
    );

  const winner =
    match
      ? winnerId(match)
      : null;


  return `

    <div
      class="bracket-match"
      data-round="${round}"
    >

      <div
        class="bracket-team ${
          winner === team1
            ? "won"
            : ""
        }"
      >

        <span>
          ${escapeHtml(
            teamName(team1)
          )}
        </span>

        <strong>
          ${
            match
              ? setWins(match, 1)
              : ""
          }
        </strong>

      </div>


      <div
        class="bracket-team ${
          winner === team2
            ? "won"
            : ""
        }"
      >

        <span>
          ${escapeHtml(
            teamName(team2)
          )}
        </span>

        <strong>
          ${
            match
              ? setWins(match, 2)
              : ""
          }
        </strong>

      </div>


      <button
        class="text-btn"
        style="
          width:100%;
          padding:7px;
          border-top:1px solid var(--line)
        "
        data-add-round="${round}"
      >

        ${
          match
            ? "Edit Match"
            : `+ Set ${label}`
        }

      </button>

    </div>

  `;
}


function renderPlayoff() {

  els.playoffBracket.innerHTML = `

    <div class="bracket-round">

      <h3>
        Quarterfinals
      </h3>

      ${
        [
          "QF1",
          "QF2",
          "QF3",
          "QF4"
        ]
          .map(
            (r, i) =>
              bracketMatchHtml(
                r,
                `QF ${i + 1}`
              )
          )
          .join("")
      }

    </div>


    <div class="bracket-round">

      <h3>
        Semifinals
      </h3>

      ${
        [
          "SF1",
          "SF2"
        ]
          .map(
            (r, i) =>
              bracketMatchHtml(
                r,
                `SF ${i + 1}`
              )
          )
          .join("")
      }

    </div>


    <div class="bracket-round">

      <h3>
        Final
      </h3>

      ${bracketMatchHtml(
        "Final",
        "Final"
      )}

    </div>


    <div class="bracket-round">

      <h3>
        Champion
      </h3>


      <div class="empty">

        ${
          (() => {

            const final =
              getPlayoffMatch(
                "Final"
              );

            const champion =
              final
                ? winnerId(final)
                : null;


            return champion

              ? `

                <strong
                  style="font-size:20px"
                >

                  ${escapeHtml(
                    teamName(
                      champion
                    )
                  )}

                </strong>

                <br>

                <span class="muted">

                  ${escapeHtml(
                    teamPlayers(
                      champion
                    )
                  )}

                </span>

              `

              : "Final belum selesai";

          })()
        }

      </div>

    </div>

  `;
}


/* =========================================================
   TEAMS
   ========================================================= */

function renderTeams() {

  const sorted =
    [...teams].sort(
      (a, b) =>
        `${a.group || ""}${
          a.name || ""
        }`.localeCompare(
          `${b.group || ""}${
            b.name || ""
          }`
        )
    );


  els.teamsGrid.innerHTML =
    sorted.length

      ? sorted
          .map(
            team => `

              <div class="team-card">

                ${
                  team.imageUrl

                    ? `

                      <img
                        src="${escapeHtml(
                          team.imageUrl
                        )}"
                        alt=""
                      >

                    `

                    : `

                      <div
                        class="team-avatar"
                        style="
                          width:52px;
                          height:52px
                        "
                      >

                        ${escapeHtml(
                          (
                            team.name ||
                            "?"
                          )
                            .slice(
                              0,
                              2
                            )
                            .toUpperCase()
                        )}

                      </div>

                    `
                }


                <div class="team-info">

                  <div class="team-group">

                    GROUP ${
                      escapeHtml(
                        team.group ||
                        "-"
                      )
                    }

                  </div>


                  <h3>

                    ${escapeHtml(
                      team.name
                    )}

                  </h3>


                  <p>

                    ${escapeHtml(
                      team.player1
                    )}

                    /

                    ${escapeHtml(
                      team.player2
                    )}

                  </p>

                </div>


                <button
                  class="btn btn-sm"
                  data-edit-team="${team.id}"
                >

                  Edit

                </button>

              </div>

            `
          )
          .join("")

      : `

        <div class="empty">
          Belum ada tim.
        </div>

      `;
}


/* =========================================================
   STATS
   ========================================================= */

function renderStats() {

  els.statTeams.textContent =
    teams.length;

  els.statGroupMatches.textContent =
    matches.filter(
      isGroupMatch
    ).length;

  els.statPlayoffMatches.textContent =
    matches.filter(
      isPlayoffMatch
    ).length;

  els.statCompleted.textContent =
    matches.filter(
      m => !!winnerId(m)
    ).length;
}


/* =========================================================
   TEAM FORM
   ========================================================= */

function openTeamModal(
  team = null
) {

  $("teamModalTitle").textContent =
    team
      ? "Edit Team"
      : "Add Team";


  $("editTeamId").value =
    team?.id || "";

  $("teamName").value =
    team?.name || "";

  $("player1").value =
    team?.player1 || "";

  $("player2").value =
    team?.player2 || "";

  $("teamGroup").value =
    team?.group || "A";

  $("teamSeed").value =
    team?.seed || "";

  $("teamImage").value =
    "";


  $("teamModal")
    .classList
    .remove("hidden");
}


async function saveTeam(e) {

  e.preventDefault();


  const id =
    $("editTeamId").value;


  const data = {

    name:
      $("teamName")
        .value
        .trim(),

    player1:
      $("player1")
        .value
        .trim(),

    player2:
      $("player2")
        .value
        .trim(),

    group:
      $("teamGroup").value,

    seed:
      Number(
        $("teamSeed").value || 0
      ),

    updatedAt:
      new Date().toISOString()

  };


  try {

    const imageFile =
      $("teamImage")
        .files[0];


    /*
      EDIT TEAM
    */

    if (id) {

      const old =
        teamById(id);


      if (imageFile) {

        showToast(
          "Memproses gambar..."
        );


        data.imageUrl =
          await compressImage(
            imageFile
          );

      }

      else if (
        old?.imageUrl
      ) {

        /*
          Pertahankan gambar
          lama.
        */

        data.imageUrl =
          old.imageUrl;
      }


      await updateDoc(
        doc(
          db,
          COLLECTIONS.teams,
          id
        ),
        data
      );

    }


    /*
      NEW TEAM
    */

    else {

      const newRef =
        await addDoc(
          collection(
            db,
            COLLECTIONS.teams
          ),
          {
            ...data,

            createdAt:
              new Date()
                .toISOString()
          }
        );


      if (imageFile) {

        showToast(
          "Memproses gambar..."
        );


        const imageUrl =
          await compressImage(
            imageFile
          );


        await updateDoc(
          newRef,
          {
            imageUrl
          }
        );
      }

    }


    $("teamModal")
      .classList
      .add("hidden");


    await loadData();


    showToast(
      "Team saved."
    );

  } catch (error) {

    console.error(error);

    showToast(
      `Gagal menyimpan tim: ${
        error.message
      }`
    );
  }
}


/* =========================================================
   MATCH FORM
   ========================================================= */

function populateTeamSelects() {

  const options =
    `
      <option value="">
        Select team
      </option>
    `

    +

    [...teams]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      )
      .map(
        t =>
          `
            <option
              value="${t.id}"
            >

              ${escapeHtml(
                t.name
              )}

              —

              G${escapeHtml(
                t.group || "-"
              )}

            </option>
          `
      )
      .join("");


  $("team1Id").innerHTML =
    options;

  $("team2Id").innerHTML =
    options;
}


function syncStageFields() {

  const playoff =
    $("matchStage").value ===
    "playoff";


  $("matchGroup").disabled =
    playoff;

  $("matchRound").disabled =
    !playoff;


  if (playoff) {

    $("matchGroup").value =
      "";

  } else {

    $("matchRound").value =
      "Group";
  }
}


function readMatchForm() {

  return {

    stage:
      $("matchStage").value,

    group:
      $("matchStage").value ===
      "group"

        ? $("matchGroup").value
        : "",

    round:
      $("matchStage").value ===
      "playoff"

        ? $("matchRound").value
        : "Group",

    date:
      $("matchDate").value,

    time:
      $("matchTime").value,

    court:
      $("matchCourt")
        .value
        .trim(),

    team1Id:
      $("team1Id").value,

    team2Id:
      $("team2Id").value,

    scores1: [

      Number(
        $("set11").value || 0
      ),

      Number(
        $("set12").value || 0
      ),

      Number(
        $("set13").value || 0
      )

    ],

    scores2: [

      Number(
        $("set21").value || 0
      ),

      Number(
        $("set22").value || 0
      ),

      Number(
        $("set23").value || 0
      )

    ],

    updatedAt:
      new Date().toISOString()

  };
}


function previewResult() {

  const data =
    readMatchForm();


  const temp =
    {
      ...data
    };


  const winner =
    winnerId(temp);


  $("previewWinner")
    .textContent =
    winner
      ? teamName(winner)
      : "—";
}


function openMatchModal(
  match = null,
  presetRound = null
) {

  populateTeamSelects();

  removeMatchImage =
    false;


  $("matchModalTitle")
    .textContent =
      match
        ? "Edit Match"
        : "Add Match";


  $("matchId").value =
    match?.id || "";


  $("matchStage").value =
    match?.stage ||
    (
      presetRound
        ? "playoff"
        : "group"
    );


  $("matchGroup").value =
    match?.group || "A";


  $("matchDate").value =
    match?.date ||
    new Date()
      .toISOString()
      .slice(0, 10);


  $("matchTime").value =
    match?.time || "";


  $("matchCourt").value =
    match?.court || "";


  $("matchRound").value =
    match?.round ||
    presetRound ||
    "Group";


  $("team1Id").value =
    match?.team1Id || "";


  $("team2Id").value =
    match?.team2Id || "";


  const s1 =
    match?.scores1 ||
    [0, 0, 0];

  const s2 =
    match?.scores2 ||
    [0, 0, 0];


  $("set11").value =
    s1[0] || "";

  $("set12").value =
    s1[1] || "";

  $("set13").value =
    s1[2] || "";


  $("set21").value =
    s2[0] || "";

  $("set22").value =
    s2[1] || "";

  $("set23").value =
    s2[2] || "";


  $("matchImage").value =
    "";


  if (match?.imageUrl) {

    $("currentImage").src =
      match.imageUrl;

    $("currentImageWrap")
      .classList
      .remove("hidden");

  } else {

    $("currentImageWrap")
      .classList
      .add("hidden");
  }


  syncStageFields();
  previewResult();


  $("matchModal")
    .classList
    .remove("hidden");
}


/* =========================================================
   SAVE MATCH
   ========================================================= */

async function saveMatch(e) {

  e.preventDefault();


  const id =
    $("matchId").value;


  const data =
    readMatchForm();


  if (
    !data.team1Id ||
    !data.team2Id ||
    data.team1Id ===
      data.team2Id
  ) {

    showToast(
      "Pilih dua tim yang berbeda."
    );

    return;
  }


  if (
    data.stage === "group" &&
    !data.group
  ) {

    showToast(
      "Group wajib dipilih."
    );

    return;
  }


  try {

    const imageFile =
      $("matchImage")
        .files[0];


    let matchRef;


    /*
      EDIT EXISTING MATCH
    */

    if (id) {

      matchRef =
        doc(
          db,
          COLLECTIONS.matches,
          id
        );


      const old =
        matches.find(
          m => m.id === id
        );


      /*
        UPLOAD / COMPRESS
        NEW IMAGE
      */

      if (imageFile) {

        showToast(
          "Memproses foto pertandingan..."
        );


        data.imageUrl =
          await compressImage(
            imageFile
          );

      }


      /*
        KEEP OLD IMAGE
      */

      else if (
        old?.imageUrl &&
        !removeMatchImage
      ) {

        data.imageUrl =
          old.imageUrl;
      }


      /*
        REMOVE IMAGE
      */

      else if (
        removeMatchImage
      ) {

        data.imageUrl =
          "";

      }


      await updateDoc(
        matchRef,
        data
      );

    }


    /*
      NEW MATCH
    */

    else {

      /*
        Simpan match dahulu.
      */

      matchRef =
        await addDoc(
          collection(
            db,
            COLLECTIONS.matches
          ),
          {
            ...data,

            createdAt:
              new Date()
                .toISOString()
          }
        );


      /*
        Setelah ID dibuat,
        kompres foto kemudian
        update dokumen.
      */

      if (imageFile) {

        showToast(
          "Memproses foto pertandingan..."
        );


        const imageUrl =
          await compressImage(
            imageFile
          );


        await updateDoc(
          matchRef,
          {
            imageUrl
          }
        );
      }

    }


    $("matchModal")
      .classList
      .add("hidden");


    await loadData();


    showToast(
      "Match saved."
    );

  } catch (error) {

    console.error(error);

    showToast(
      `Gagal menyimpan pertandingan: ${
        error.message
      }`
    );
  }
}


/* =========================================================
   DELETE
   ========================================================= */

async function deleteMatch(id) {

  const match =
    matches.find(
      m => m.id === id
    );


  if (!match) return;


  if (
    !confirm(
      `Hapus pertandingan ${
        teamName(
          match.team1Id
        )
      } vs ${
        teamName(
          match.team2Id
        )
      }?`
    )
  ) {

    return;
  }


  try {

    /*
      Tidak ada lagi
      delete Storage.
    */

    await deleteDoc(
      doc(
        db,
        COLLECTIONS.matches,
        id
      )
    );


    await loadData();


    showToast(
      "Match deleted."
    );

  } catch (error) {

    console.error(error);

    showToast(
      `Gagal menghapus match: ${
        error.message
      }`
    );
  }
}


async function deleteTeam(id) {

  const team =
    teamById(id);


  if (!team) return;


  const hasMatch =
    matches.some(
      m =>
        m.team1Id === id ||
        m.team2Id === id
    );


  if (hasMatch) {

    showToast(
      "Tim tidak dapat dihapus karena sudah memiliki pertandingan."
    );

    return;
  }


  if (
    !confirm(
      `Hapus ${team.name}?`
    )
  ) {

    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        COLLECTIONS.teams,
        id
      )
    );


    await loadData();


    showToast(
      "Team deleted."
    );

  } catch (error) {

    console.error(error);

    showToast(
      `Gagal menghapus tim: ${
        error.message
      }`
    );
  }
}


/* =========================================================
   SETTINGS
   ========================================================= */

async function saveSettings(e) {

  e.preventDefault();


  try {

    settings = {

      title:
        $("settingsTitle")
          .value
          .trim() ||
        DEFAULT_TITLE,

      subtitle:
        $("settingsSubtitle")
          .value
          .trim() ||
        DEFAULT_SUBTITLE,

      updatedAt:
        new Date().toISOString()

    };


    await setDoc(

      doc(
        db,
        COLLECTIONS.settings,
        "main"
      ),

      settings,

      {
        merge: true
      }

    );


    applySettings();


    $("adminModal")
      .classList
      .add("hidden");


    showToast(
      "Settings saved."
    );

  } catch (error) {

    console.error(error);

    showToast(
      `Gagal menyimpan settings: ${
        error.message
      }`
    );
  }
}


/* =========================================================
   ROUTING
   ========================================================= */

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(
      el =>
        el.classList
          .remove("active")
    );


  document
    .querySelectorAll(".tab")
    .forEach(
      el =>
        el.classList
          .remove("active")
    );


  const pageElement =
    $(`page-${page}`);


  if (pageElement) {

    pageElement
      .classList
      .add("active");
  }


  document
    .querySelector(
      `.tab[data-page="${page}"]`
    )
    ?.classList
    .add("active");


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   EVENTS
   ========================================================= */

document.addEventListener(
  "click",
  (e) => {

    const tab =
      e.target.closest(
        "[data-page]"
      );


    if (tab) {

      showPage(
        tab.dataset.page
      );

      return;
    }


    const target =
      e.target.closest(
        "[data-page-target]"
      );


    if (target) {

      showPage(
        target.dataset.pageTarget
      );

      return;
    }


    const close =
      e.target.closest(
        "[data-close]"
      );


    if (close) {

      $(close.dataset.close)
        ?.classList
        .add("hidden");

      return;
    }


    const editMatch =
      e.target.closest(
        "[data-edit-match]"
      );


    if (editMatch) {

      openMatchModal(
        matches.find(
          m =>
            m.id ===
            editMatch.dataset
              .editMatch
        )
      );

      return;
    }


    const deleteMatchBtn =
      e.target.closest(
        "[data-delete-match]"
      );


    if (deleteMatchBtn) {

      deleteMatch(
        deleteMatchBtn.dataset
          .deleteMatch
      );

      return;
    }


    const editTeam =
      e.target.closest(
        "[data-edit-team]"
      );


    if (editTeam) {

      openTeamModal(
        teamById(
          editTeam.dataset
            .editTeam
        )
      );

      return;
    }


    const addRound =
      e.target.closest(
        "[data-add-round]"
      );


    if (addRound) {

      openMatchModal(
        getPlayoffMatch(
          addRound.dataset
            .addRound
        ),

        addRound.dataset
          .addRound
      );

      return;
    }

  }
);


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

$("addMatchBtn")
  ?.addEventListener(
    "click",
    () =>
      openMatchModal()
  );


$("addTeamBtn")
  ?.addEventListener(
    "click",
    () =>
      openTeamModal()
  );


$("adminBtn")
  ?.addEventListener(
    "click",
    () =>
      $("adminModal")
        .classList
        .remove("hidden")
  );


$("matchStage")
  ?.addEventListener(
    "change",
    syncStageFields
  );


[
  "team1Id",
  "team2Id",
  "set11",
  "set12",
  "set13",
  "set21",
  "set22",
  "set23"
].forEach(id => {

  $(id)?.addEventListener(
    "input",
    previewResult
  );

});


$("scheduleStage")
  ?.addEventListener(
    "change",
    renderSchedule
  );


$("scheduleGroup")
  ?.addEventListener(
    "change",
    renderSchedule
  );


/* =========================================================
   REMOVE MATCH IMAGE
   ========================================================= */

$("removeImageBtn")
  ?.addEventListener(
    "click",
    () => {

      removeMatchImage =
        true;


      $("currentImageWrap")
        ?.classList
        .add("hidden");

    }
  );


/* =========================================================
   FORM EVENTS
   ========================================================= */

$("matchForm")
  ?.addEventListener(
    "submit",
    saveMatch
  );


$("teamForm")
  ?.addEventListener(
    "submit",
    saveTeam
  );


$("settingsForm")
  ?.addEventListener(
    "submit",
    saveSettings
  );


/* =========================================================
   IMAGE PREVIEW
   ========================================================= */

previewSelectedImage(
  "matchImage",
  "currentImage",
  "currentImageWrap"
);


/* =========================================================
   RENDER ALL
   ========================================================= */

function renderAll() {

  renderStats();

  renderStandings();

  renderSchedule();

  renderLatestResults();

  renderPlayoff();

  renderTeams();
}


/* =========================================================
   START
   ========================================================= */

loadData();
