import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain: "YOUR_PROJECT.firebaseapp.com",

    projectId: "YOUR_PROJECT_ID",

    storageBucket: "YOUR_PROJECT.firebasestorage.app",

    messagingSenderId: "YOUR_SENDER_ID",

    appId: "YOUR_APP_ID"

};


const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


// ======================================================
// COLLECTION CONFIG
// ======================================================

const COLLECTIONS = {

    teams: "tennisTeams",

    groups: "tennisGroups",

    matches: "tennisMatches",

    playoffs: "tennisPlayoffs"

};


// ======================================================
// GLOBAL DATA
// ======================================================

let teams = [];

let groups = [];

let matches = [];

let playoffs = [];

let editingMatchId = null;


// ======================================================
// DOM
// ======================================================

const matchList =
    document.getElementById("matchList");

const standingsContainer =
    document.getElementById("standingsContainer");

const playoffBracket =
    document.getElementById("playoffBracket");

const groupFilter =
    document.getElementById("groupFilter");

const matchStatusFilter =
    document.getElementById("matchStatusFilter");

const matchModal =
    document.getElementById("matchModal");

const matchForm =
    document.getElementById("matchForm");


// ======================================================
// INITIAL LOAD
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    await loadData();

    setupEvents();

    populateFilters();

    renderMatches();

    renderStandings();

    renderPlayoff();

}


// ======================================================
// LOAD FIRESTORE DATA
// ======================================================

async function loadData() {

    try {

        const [
            teamsSnap,
            groupsSnap,
            matchesSnap,
            playoffSnap
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
                    COLLECTIONS.groups
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.matches
                )
            ),

            getDocs(
                collection(
                    db,
                    COLLECTIONS.playoffs
                )
            )

        ]);


        teams =
            teamsSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        groups =
            groupsSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        matches =
            matchesSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


        playoffs =
            playoffSnap.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );


    } catch (error) {

        console.error(error);

        showToast(
            "Gagal mengambil data Firebase"
        );

    }

}


// ======================================================
// EVENTS
// ======================================================

function setupEvents() {

    // TAB

    document.querySelectorAll(".tab")
        .forEach(tab => {

            tab.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".tab")
                        .forEach(
                            x =>
                                x.classList.remove(
                                    "active"
                                )
                        );

                    document
                        .querySelectorAll(".tab-content")
                        .forEach(
                            x =>
                                x.classList.remove(
                                    "active"
                                )
                        );


                    tab.classList.add("active");

                    document
                        .getElementById(
                            tab.dataset.tab
                        )
                        .classList.add("active");

                }
            );

        });


    // FILTER

    groupFilter.addEventListener(
        "change",
        renderMatches
    );


    matchStatusFilter.addEventListener(
        "change",
        renderMatches
    );


    // ADD MATCH

    document
        .getElementById("btnAddMatch")
        .addEventListener(
            "click",
            () => openMatchModal()
        );


    // CLOSE MODAL

    document
        .getElementById("btnCloseModal")
        .addEventListener(
            "click",
            closeMatchModal
        );


    document
        .getElementById("btnCancel")
        .addEventListener(
            "click",
            closeMatchModal
        );


    document
        .querySelector(".modal-overlay")
        .addEventListener(
            "click",
            closeMatchModal
        );


    // FORM

    matchForm.addEventListener(
        "submit",
        saveMatch
    );


    // DELETE

    document
        .getElementById("btnDeleteMatch")
        .addEventListener(
            "click",
            deleteMatch
        );


    // REFRESH

    document
        .getElementById("btnRefresh")
        .addEventListener(
            "click",
            async () => {

                await loadData();

                populateFilters();

                renderMatches();

                renderStandings();

                renderPlayoff();

                showToast(
                    "Data diperbarui"
                );

            }
        );


    // TEAM NAME UPDATE

    document
        .getElementById("homeTeam")
        .addEventListener(
            "change",
            updateScoreNames
        );


    document
        .getElementById("awayTeam")
        .addEventListener(
            "change",
            updateScoreNames
        );


    // GROUP UPDATE

    document
        .getElementById("matchGroup")
        .addEventListener(
            "change",
            () => {

                populateTeamSelects(
                    document
                        .getElementById(
                            "matchGroup"
                        )
                        .value
                );

            }
        );

}


// ======================================================
// FILTER
// ======================================================

function populateFilters() {

    groupFilter.innerHTML = `
        <option value="all">
            Semua Group
        </option>
    `;


    groups
        .sort(
            (a,b) =>
                (a.name || "")
                .localeCompare(
                    b.name || ""
                )
        )
        .forEach(group => {

            groupFilter.innerHTML += `
                <option value="${group.id}">
                    ${group.name}
                </option>
            `;

        });

}


// ======================================================
// RENDER MATCHES
// ======================================================

function renderMatches() {

    const selectedGroup =
        groupFilter.value;

    const selectedStatus =
        matchStatusFilter.value;


    let filtered =
        [...matches];


    if (
        selectedGroup !== "all"
    ) {

        filtered =
            filtered.filter(
                match =>
                    match.groupId ===
                    selectedGroup
            );

    }


    if (
        selectedStatus !== "all"
    ) {

        filtered =
            filtered.filter(
                match =>
                    match.status ===
                    selectedStatus
            );

    }


    filtered.sort(
        (a,b) =>
            (a.round || 0) -
            (b.round || 0)
    );


    if (!filtered.length) {

        matchList.innerHTML = `
            <div class="match-card">
                Belum ada pertandingan.
            </div>
        `;

        return;

    }


    matchList.innerHTML =
        filtered
            .map(
                match =>
                    createMatchHTML(
                        match
                    )
            )
            .join("");


    document
        .querySelectorAll(".match-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                () =>
                    openMatchModal(
                        card.dataset.id
                    )
            );

        });

}


// ======================================================
// MATCH HTML
// ======================================================

function createMatchHTML(match) {

    const home =
        getTeam(
            match.homeTeamId
        );

    const away =
        getTeam(
            match.awayTeamId
        );

    const group =
        getGroup(
            match.groupId
        );


    const homeSets =
        match.homeScore || [];

    const awaySets =
        match.awayScore || [];


    const score =
        match.status === "finished"

            ? `
                ${formatScore(
                    homeSets
                )}
                -
                ${formatScore(
                    awaySets
                )}
              `

            : "vs";


    return `

        <div
            class="match-card"
            data-id="${match.id}">

            <div class="match-meta">

                <strong>
                    ${group?.name || "-"}
                </strong>

                <br>

                R${match.round || "-"}

                ${
                    match.date
                        ? `<br>${match.date}`
                        : ""
                }

            </div>


            <div class="match-teams">

                <div class="team-line">

                    <span class="team-name">
                        ${home?.name || "TBD"}
                    </span>

                    <span class="team-score">
                        ${
                            match.status === "finished"
                                ? formatScore(
                                    homeSets
                                  )
                                : ""
                        }
                    </span>

                </div>


                <div class="team-line">

                    <span class="team-name">
                        ${away?.name || "TBD"}
                    </span>

                    <span class="team-score">
                        ${
                            match.status === "finished"
                                ? formatScore(
                                    awaySets
                                  )
                                : ""
                        }
                    </span>

                </div>

            </div>


            <div class="match-result">

                <span
                    class="
                        status-badge
                        status-${match.status}
                    ">

                    ${
                        match.status === "finished"
                            ? "FINISHED"
                            : "SCHEDULED"
                    }

                </span>

            </div>

        </div>

    `;

}


// ======================================================
// FORMAT SCORE
// ======================================================

function formatScore(scores = []) {

    if (!scores.length) {

        return "-";

    }

    return scores.join(" / ");

}


// ======================================================
// STANDINGS
// ======================================================

function renderStandings() {

    standingsContainer.innerHTML = "";


    groups.forEach(group => {

        const groupTeams =
            teams.filter(
                team =>
                    team.groupId ===
                    group.id
            );


        const standings =
            calculateStandings(
                group.id,
                groupTeams
            );


        standingsContainer.innerHTML += `

            <div class="standing-card">

                <div class="standing-header">

                    <strong>
                        ${group.name}
                    </strong>

                    <span>
                        ${groupTeams.length} Teams
                    </span>

                </div>


                <table
                    class="standing-table">

                    <thead>

                        <tr>

                            <th>#</th>

                            <th>Team</th>

                            <th>P</th>

                            <th>W</th>

                            <th>L</th>

                            <th>SW</th>

                            <th>SL</th>

                            <th>Pts</th>

                        </tr>

                    </thead>


                    <tbody>

                        ${

                            standings
                                .map(
                                    (team, index) => `

                                    <tr>

                                        <td>

                                            <span
                                                class="
                                                    rank
                                                    ${
                                                        index < 2
                                                            ? "rank-qualified"
                                                            : "rank-normal"
                                                    }
                                                ">

                                                ${index + 1}

                                            </span>

                                        </td>


                                        <td>
                                            <strong>
                                                ${team.name}
                                            </strong>
                                        </td>


                                        <td>
                                            ${team.played}
                                        </td>


                                        <td>
                                            ${team.wins}
                                        </td>


                                        <td>
                                            ${team.losses}
                                        </td>


                                        <td>
                                            ${team.setWin}
                                        </td>


                                        <td>
                                            ${team.setLoss}
                                        </td>


                                        <td>
                                            <strong>
                                                ${team.points}
                                            </strong>
                                        </td>

                                    </tr>

                                `
                                )
                                .join("")

                        }

                    </tbody>

                </table>

            </div>

        `;

    });

}


// ======================================================
// CALCULATE STANDINGS
// ======================================================

function calculateStandings(
    groupId,
    groupTeams
) {

    const table =
        groupTeams.map(
            team => ({

                id: team.id,

                name: team.name,

                played: 0,

                wins: 0,

                losses: 0,

                setWin: 0,

                setLoss: 0,

                points: 0

            })
        );


    const teamMap =
        new Map(
            table.map(
                team =>
                    [team.id, team]
            )
        );


    matches
        .filter(
            match =>
                match.groupId ===
                groupId &&
                match.status ===
                "finished"
        )
        .forEach(match => {

            const home =
                teamMap.get(
                    match.homeTeamId
                );

            const away =
                teamMap.get(
                    match.awayTeamId
                );


            if (!home || !away)
                return;


            home.played++;

            away.played++;


            const homeScore =
                match.homeScore || [];

            const awayScore =
                match.awayScore || [];


            let homeSets = 0;

            let awaySets = 0;


            homeScore.forEach(
                (score, index) => {

                    const a =
                        Number(score);

                    const b =
                        Number(
                            awayScore[index] || 0
                        );


                    if (a > b)
                        homeSets++;

                    if (b > a)
                        awaySets++;

                }
            );


            home.setWin += homeSets;

            home.setLoss += awaySets;

            away.setWin += awaySets;

            away.setLoss += homeSets;


            if (
                homeSets >
                awaySets
            ) {

                home.wins++;

                away.losses++;

                home.points += 3;

            } else {

                away.wins++;

                home.losses++;

                away.points += 3;

            }

        });


    return table.sort(
        (a,b) => {

            if (
                b.points !==
                a.points
            ) {

                return (
                    b.points -
                    a.points
                );

            }


            const bDiff =
                b.setWin -
                b.setLoss;


            const aDiff =
                a.setWin -
                a.setLoss;


            if (
                bDiff !==
                aDiff
            ) {

                return (
                    bDiff -
                    aDiff
                );

            }


            return (
                b.setWin -
                a.setWin
            );

        }
    );

}


// ======================================================
// PLAYOFF
// ======================================================

function renderPlayoff() {

    playoffBracket.innerHTML = "";


    const qualified = [];


    groups.forEach(group => {

        const groupTeams =
            teams.filter(
                team =>
                    team.groupId ===
                    group.id
            );


        const standings =
            calculateStandings(
                group.id,
                groupTeams
            );


        if (
            standings[0]
        ) {

            qualified.push({

                seed:
                    1,

                groupId:
                    group.id,

                group:
                    group.name,

                team:
                    standings[0]

            });

        }


        if (
            standings[1]
        ) {

            qualified.push({

                seed:
                    2,

                groupId:
                    group.id,

                group:
                    group.name,

                team:
                    standings[1]

            });

        }

    });


    /*
     * Untuk 2 group:
     *
     * SF1:
     * Winner A vs Runner-up B
     *
     * SF2:
     * Winner B vs Runner-up A
     */

    if (
        qualified.length === 4
    ) {

        renderFourTeamPlayoff(
            qualified
        );

        return;

    }


    /*
     * Untuk sementara tampilkan
     * qualified teams jika jumlah
     * group bukan 2.
     */

    playoffBracket.innerHTML = `

        <div class="standing-card">

            <div class="standing-header">

                <strong>
                    Qualified Teams
                </strong>

            </div>

            <div style="padding:20px">

                ${

                    qualified
                        .map(
                            item => `

                            <div
                                style="
                                    padding:10px;
                                    border-bottom:
                                        1px solid #eee;
                                ">

                                ${item.group}
                                -
                                ${item.seed}

                                :

                                <strong>
                                    ${item.team.name}
                                </strong>

                            </div>

                        `
                        )
                        .join("")

                }

            </div>

        </div>

    `;

}


// ======================================================
// 4 TEAM PLAYOFF
// ======================================================

function renderFourTeamPlayoff(
    qualified
) {

    const groupA =
        qualified.filter(
            x =>
                x.group ===
                qualified[0].group
        );


    const groupB =
        qualified.filter(
            x =>
                x.group !==
                qualified[0].group
        );


    const winnerA =
        groupA.find(
            x =>
                x.seed === 1
        );


    const runnerA =
        groupA.find(
            x =>
                x.seed === 2
        );


    const winnerB =
        groupB.find(
            x =>
                x.seed === 1
        );


    const runnerB =
        groupB.find(
            x =>
                x.seed === 2
        );


    playoffBracket.innerHTML = `

        <!-- SEMIFINAL -->

        <div class="playoff-round">

            <h4>
                Semifinal
            </h4>


            ${

                playoffMatchHTML(
                    winnerA?.team,
                    runnerB?.team
                )

            }


            ${

                playoffMatchHTML(
                    winnerB?.team,
                    runnerA?.team
                )

            }

        </div>


        <!-- FINAL -->

        <div class="playoff-round">

            <h4>
                Final
            </h4>


            ${

                playoffMatchHTML(
                    {
                        name:
                            "Winner SF1"
                    },
                    {
                        name:
                            "Winner SF2"
                    }
                )

            }

        </div>


        <!-- CHAMPION -->

        <div class="playoff-round">

            <h4>
                Champion
            </h4>


            <div
                class="playoff-match">

                <div
                    class="
                        playoff-team
                        winner
                    ">

                    🏆

                    <strong>
                        Winner Final
                    </strong>

                </div>

            </div>

        </div>

    `;

}


// ======================================================
// PLAYOFF MATCH HTML
// ======================================================

function playoffMatchHTML(
    team1,
    team2
) {

    return `

        <div
            class="playoff-match">

            <div
                class="playoff-team">

                <span>
                    ${team1?.name || "TBD"}
                </span>

                <strong>
                    -
                </strong>

            </div>


            <div
                class="playoff-team">

                <span>
                    ${team2?.name || "TBD"}
                </span>

                <strong>
                    -
                </strong>

            </div>

        </div>

    `;

}


// ======================================================
// OPEN MODAL
// ======================================================

function openMatchModal(
    matchId = null
) {

    editingMatchId =
        matchId;


    matchForm.reset();


    document
        .getElementById(
            "btnDeleteMatch"
        )
        .style.display =
            matchId
                ? "block"
                : "none";


    populateGroupSelect();


    if (!matchId) {

        document
            .getElementById(
                "modalTitle"
            )
            .textContent =
                "Add Match";


        document
            .getElementById(
                "matchStatus"
            )
            .value =
                "scheduled";


        matchModal.classList.remove(
            "hidden"
        );

        return;

    }


    const match =
        matches.find(
            m =>
                m.id ===
                matchId
        );


    if (!match)
        return;


    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
            "Edit Match";


    document
        .getElementById(
            "matchId"
        )
        .value =
            match.id;


    document
        .getElementById(
            "matchGroup"
        )
        .value =
            match.groupId;


    populateTeamSelects(
        match.groupId
    );


    document
        .getElementById(
            "matchRound"
        )
        .value =
            match.round || 1;


    document
        .getElementById(
            "matchDate"
        )
        .value =
            match.date || "";


    document
        .getElementById(
            "matchTime"
        )
        .value =
            match.time || "";


    document
        .getElementById(
            "homeTeam"
        )
        .value =
            match.homeTeamId;


    document
        .getElementById(
            "awayTeam"
        )
        .value =
            match.awayTeamId;


    document
        .getElementById(
            "matchStatus"
        )
        .value =
            match.status ||
            "scheduled";


    setScoreInputs(
        match.homeScore || [],
        match.awayScore || []
    );


    updateScoreNames();


    matchModal.classList.remove(
        "hidden"
    );

}


// ======================================================
// GROUP SELECT
// ======================================================

function populateGroupSelect() {

    const select =
        document.getElementById(
            "matchGroup"
        );


    select.innerHTML =
        groups
            .map(
                group => `

                    <option
                        value="${group.id}">

                        ${group.name}

                    </option>

                `
            )
            .join("");


    if (groups.length) {

        populateTeamSelects(
            groups[0].id
        );

    }

}


// ======================================================
// TEAM SELECT
// ======================================================

function populateTeamSelects(
    groupId
) {

    const groupTeams =
        teams.filter(
            team =>
                team.groupId ===
                groupId
        );


    const home =
        document.getElementById(
            "homeTeam"
        );


    const away =
        document.getElementById(
            "awayTeam"
        );


    const options =
        groupTeams
            .map(
                team => `

                    <option
                        value="${team.id}">

                        ${team.name}

                    </option>

                `
            )
            .join("");


    home.innerHTML =
        options;

    away.innerHTML =
        options;


    if (
        groupTeams.length > 1
    ) {

        away.value =
            groupTeams[1].id;

    }


    updateScoreNames();

}


// ======================================================
// SCORE NAME
// ======================================================

function updateScoreNames() {

    const home =
        getTeam(
            document
                .getElementById(
                    "homeTeam"
                )
                .value
        );


    const away =
        getTeam(
            document
                .getElementById(
                    "awayTeam"
                )
                .value
        );


    document
        .getElementById(
            "homeScoreName"
        )
        .textContent =
            home?.name ||
            "Team 1";


    document
        .getElementById(
            "awayScoreName"
        )
        .textContent =
            away?.name ||
            "Team 2";

}


// ======================================================
// SET SCORE
// ======================================================

function setScoreInputs(
    home,
    away
) {

    const ids = [
        "homeSet1",
        "homeSet2",
        "homeSet3"
    ];


    const awayIds = [
        "awaySet1",
        "awaySet2",
        "awaySet3"
    ];


    ids.forEach(
        (id, index) => {

            document
                .getElementById(
                    id
                )
                .value =
                    home[index] ??
                    "";

        }
    );


    awayIds.forEach(
        (id, index) => {

            document
                .getElementById(
                    id
                )
                .value =
                    away[index] ??
                    "";

        }
    );

}


// ======================================================
// SAVE MATCH
// ======================================================

async function saveMatch(
    event
) {

    event.preventDefault();


    const homeScore =
        getScoreValues(
            "homeSet"
        );


    const awayScore =
        getScoreValues(
            "awaySet"
        );


    const data = {

        groupId:
            document
                .getElementById(
                    "matchGroup"
                )
                .value,

        round:
            Number(
                document
                    .getElementById(
                        "matchRound"
                    )
                    .value
            ),

        date:
            document
                .getElementById(
                    "matchDate"
                )
                .value,

        time:
            document
                .getElementById(
                    "matchTime"
                )
                .value,

        homeTeamId:
            document
                .getElementById(
                    "homeTeam"
                )
                .value,

        awayTeamId:
            document
                .getElementById(
                    "awayTeam"
                )
                .value,

        homeScore,

        awayScore,

        status:
            document
                .getElementById(
                    "matchStatus"
                )
                .value,

        updatedAt:
            new Date().toISOString()

    };


    try {

        if (editingMatchId) {

            await updateDoc(

                doc(
                    db,
                    COLLECTIONS.matches,
                    editingMatchId
                ),

                data

            );

            showToast(
                "Match diperbarui"
            );

        } else {

            data.createdAt =
                new Date().toISOString();


            await addDoc(

                collection(
                    db,
                    COLLECTIONS.matches
                ),

                data

            );


            showToast(
                "Match berhasil dibuat"
            );

        }


        closeMatchModal();

        await loadData();

        renderMatches();

        renderStandings();

        renderPlayoff();


    } catch (error) {

        console.error(error);

        showToast(
            "Gagal menyimpan match"
        );

    }

}


// ======================================================
// GET SCORE VALUES
// ======================================================

function getScoreValues(
    prefix
) {

    const result = [];


    for (
        let i = 1;
        i <= 3;
        i++
    ) {

        const value =
            document
                .getElementById(
                    `${prefix}${i}`
                )
                .value;


        if (value !== "") {

            result.push(
                Number(value)
            );

        }

    }


    return result;

}


// ======================================================
// DELETE
// ======================================================

async function deleteMatch() {

    if (!editingMatchId)
        return;


    const confirmDelete =
        confirm(
            "Hapus pertandingan ini?"
        );


    if (!confirmDelete)
        return;


    try {

        await deleteDoc(

            doc(
                db,
                COLLECTIONS.matches,
                editingMatchId
            )

        );


        showToast(
            "Match dihapus"
        );


        closeMatchModal();

        await loadData();

        renderMatches();

        renderStandings();

        renderPlayoff();


    } catch (error) {

        console.error(error);

        showToast(
            "Gagal menghapus match"
        );

    }

}


// ======================================================
// CLOSE MODAL
// ======================================================

function closeMatchModal() {

    matchModal.classList.add(
        "hidden"
    );

    editingMatchId =
        null;

}


// ======================================================
// GET TEAM
// ======================================================

function getTeam(
    id
) {

    return teams.find(
        team =>
            team.id === id
    );

}


// ======================================================
// GET GROUP
// ======================================================

function getGroup(
    id
) {

    return groups.find(
        group =>
            group.id === id
    );

}


// ======================================================
// TOAST
// ======================================================

function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}
