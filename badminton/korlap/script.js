import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================

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


// ======================================================
// COLLECTIONS
// ======================================================

const membersRef =
    collection(db, "badmintonMembers");

const matchesRef =
    collection(db, "badmintonMatches");

const paymentsRef =
    collection(db, "badmintonPayments");


// ======================================================
// STATE
// ======================================================

let members = [];

let matches = [];

let payments = [];

let currentPhotoUrl = "";


// ======================================================
// ELEMENTS
// ======================================================

const pages = {

    dashboard:
        document.getElementById("dashboardPage"),

    matches:
        document.getElementById("matchesPage"),

    members:
        document.getElementById("membersPage"),

    cash:
        document.getElementById("cashPage"),

    statistics:
        document.getElementById("statisticsPage")

};


const pageTitle =
    document.getElementById("pageTitle");


// ======================================================
// INITIAL LOAD
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadAllData();

        setupNavigation();

        setupEvents();

        renderDashboard();

    }
);


// ======================================================
// LOAD FIRESTORE
// ======================================================

async function loadAllData() {

    try {

        const memberSnapshot =
            await getDocs(membersRef);

        members =
            memberSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));


        const matchSnapshot =
            await getDocs(matchesRef);

        matches =
            matchSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));


        const paymentSnapshot =
            await getDocs(paymentsRef);

        payments =
            paymentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));


    } catch (error) {

        console.error(
            "Firebase Error:",
            error
        );

        alert(
            "Gagal mengambil data Firebase."
        );

    }

}


// ======================================================
// NAVIGATION
// ======================================================

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;

                    showPage(page);

                }
            );

        });

}


function showPage(page) {

    Object.values(pages)
        .forEach(item =>
            item.classList.add("hidden")
        );


    pages[page]
        .classList.remove("hidden");


    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });


    const titles = {

        dashboard:
            "Dashboard",

        matches:
            "Pertandingan",

        members:
            "Anggota Klub",

        cash:
            "Summary Kas Anggota",

        statistics:
            "Summary Permainan"

    };


    pageTitle.textContent =
        titles[page];


    if (page === "dashboard")
        renderDashboard();

    if (page === "matches")
        renderMatches();

    if (page === "members")
        renderMembers();

    if (page === "cash")
        renderCashSummary();

    if (page === "statistics")
        renderStatistics();

}


// ======================================================
// EVENTS
// ======================================================

function setupEvents() {

    document
        .getElementById("addMatchBtn")
        .onclick = openMatchModal;

    document
        .getElementById("addMatchBtn2")
        .onclick = openMatchModal;

    document
        .getElementById("addMemberBtn")
        .onclick = openMemberModal;


    document
        .getElementById("closeMatchModal")
        .onclick = closeMatchModal;

    document
        .getElementById("cancelMatchBtn")
        .onclick = closeMatchModal;


    document
        .getElementById("closeMemberModal")
        .onclick = closeMemberModal;

    document
        .getElementById("cancelMemberBtn")
        .onclick = closeMemberModal;


    document
        .getElementById("addPlayerBtn")
        .onclick = addPlayerRow;


    document
        .getElementById("cockQty")
        .addEventListener(
            "input",
            updateCockPreview
        );


    document
        .getElementById("cockPrice")
        .addEventListener(
            "input",
            updateCockPreview
        );


    document
        .getElementById("matchPhoto")
        .addEventListener(
            "change",
            previewPhoto
        );


    document
        .getElementById("matchForm")
        .addEventListener(
            "submit",
            saveMatch
        );


    document
        .getElementById("memberForm")
        .addEventListener(
            "submit",
            saveMember
        );

}


// ======================================================
// MATCH MODAL
// ======================================================

function openMatchModal() {

    document
        .getElementById("matchModal")
        .classList.remove("hidden");


    document
        .getElementById("matchForm")
        .reset();


    document
        .getElementById("playersContainer")
        .innerHTML = "";


    document
        .getElementById("photoPreview")
        .innerHTML = "";


    currentPhotoUrl = "";


    addPlayerRow();

    addPlayerRow();

}


function closeMatchModal() {

    document
        .getElementById("matchModal")
        .classList.add("hidden");

}


// ======================================================
// PLAYERS
// ======================================================

function addPlayerRow() {

    const container =
        document.getElementById(
            "playersContainer"
        );


    const row =
        document.createElement("div");


    row.className =
        "player-row";


    row.innerHTML = `

        <select class="player-member" required>

            <option value="">
                Pilih pemain
            </option>

            ${members.map(member => `
                <option value="${member.id}">
                    ${escapeHtml(member.name)}
                </option>
            `).join("")}

        </select>


        <input
            type="number"
            class="player-score"
            placeholder="Skor"
            min="0"
            required
        >


        <select class="player-result">

            <option value="WIN">
                Menang
            </option>

            <option value="LOSS">
                Kalah
            </option>

        </select>


        <button
            type="button"
            class="remove-player">
            ×
        </button>

    `;


    row
        .querySelector(".remove-player")
        .onclick = () =>
            row.remove();


    container.appendChild(row);

}


// ======================================================
// COCK CALCULATION
// ======================================================

function updateCockPreview() {

    const price =
        Number(
            document.getElementById(
                "cockPrice"
            ).value
        ) || 0;


    const qty =
        Number(
            document.getElementById(
                "cockQty"
            ).value
        ) || 0;


    const total =
        price * qty;


    document
        .getElementById(
            "cockTotalPreview"
        )
        .value =
        formatRupiah(total);

}


// ======================================================
// PHOTO PREVIEW
// ======================================================

function previewPhoto(event) {

    const file =
        event.target.files[0];


    if (!file)
        return;


    const reader =
        new FileReader();


    reader.onload = e => {

        document
            .getElementById(
                "photoPreview"
            )
            .innerHTML = `
                <img src="${e.target.result}">
            `;

    };


    reader.readAsDataURL(file);

}


// ======================================================
// SAVE MATCH
// ======================================================

async function saveMatch(event) {

    event.preventDefault();


    const date =
        document
            .getElementById(
                "matchDate"
            ).value;


    const cockPrice =
        Number(
            document
                .getElementById(
                    "cockPrice"
                ).value
        );


    const cockQty =
        Number(
            document
                .getElementById(
                    "cockQty"
                ).value
        );


    const cockTotal =
        cockPrice * cockQty;


    const playerRows =
        document.querySelectorAll(
            ".player-row"
        );


    const players = [];


    playerRows.forEach(row => {

        const memberId =
            row.querySelector(
                ".player-member"
            ).value;


        const member =
            members.find(
                item =>
                    item.id === memberId
            );


        const score =
            Number(
                row.querySelector(
                    ".player-score"
                ).value
            );


        const result =
            row.querySelector(
                ".player-result"
            ).value;


        if (member) {

            players.push({

                memberId,

                name:
                    member.name,

                score,

                result

            });

        }

    });


    if (players.length < 2) {

        alert(
            "Minimal 2 pemain."
        );

        return;

    }


    const photoFile =
        document
            .getElementById(
                "matchPhoto"
            ).files[0];


    let photoUrl =
        currentPhotoUrl;


    /*
     * TEMPORARY PHOTO HANDLER
     *
     * Ganti bagian ini dengan
     * fungsi upload gambar yang
     * sudah berhasil pada
     * Tennis-League Anda.
     */

    if (photoFile) {

        photoUrl =
            await uploadPhoto(
                photoFile
            );

    }


    try {

        await addDoc(
            matchesRef,
            {

                date,

                players,

                cockQty,

                cockPrice,

                cockTotal,

                photoUrl,

                notes:
                    document
                        .getElementById(
                            "matchNotes"
                        ).value,

                createdAt:
                    serverTimestamp()

            }
        );


        alert(
            "Pertandingan berhasil disimpan."
        );


        closeMatchModal();


        await loadAllData();


        showPage("matches");


    } catch (error) {

        console.error(error);

        alert(
            "Gagal menyimpan pertandingan."
        );

    }

}


// ======================================================
// PHOTO UPLOAD
// ======================================================

async function uploadPhoto(file) {

    /*
     * HUBUNGKAN DENGAN SISTEM UPLOAD
     * TENNIS-LEAGUE ANDA DI SINI.
     *
     * Jangan menggunakan Base64 ke Firestore
     * karena ukuran Firestore terbatas.
     */

    return "";

}


// ======================================================
// MEMBERS
// ======================================================

function openMemberModal() {

    document
        .getElementById(
            "memberModal"
        )
        .classList.remove("hidden");

}


function closeMemberModal() {

    document
        .getElementById(
            "memberModal"
        )
        .classList.add("hidden");

}


async function saveMember(event) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "memberName"
            ).value.trim();


    const phone =
        document
            .getElementById(
                "memberPhone"
            ).value.trim();


    if (!name)
        return;


    try {

        await addDoc(
            membersRef,
            {

                name,

                phone,

                status:
                    "ACTIVE",

                createdAt:
                    serverTimestamp()

            }
        );


        closeMemberModal();


        document
            .getElementById(
                "memberForm"
            ).reset();


        await loadAllData();


        showPage("members");


    } catch (error) {

        console.error(error);

        alert(
            "Gagal menyimpan anggota."
        );

    }

}


// ======================================================
// MATCH TABLE
// ======================================================

function renderMatches() {

    const container =
        document.getElementById(
            "matchesTable"
        );


    if (!matches.length) {

        container.innerHTML =
            `<p>Belum ada pertandingan.</p>`;

        return;

    }


    const sorted =
        [...matches]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Tanggal</th>

                    <th>Pemain</th>

                    <th>Skor</th>

                    <th>Cock</th>

                    <th>Harga Cock</th>

                    <th>Foto</th>

                    <th></th>

                </tr>

            </thead>


            <tbody>

                ${sorted.map(match => `

                    <tr>

                        <td>
                            ${formatDate(match.date)}
                        </td>


                        <td>

                            ${match.players
                                ?.map(
                                    player =>
                                        `<div>
                                            ${escapeHtml(player.name)}
                                        </div>`
                                )
                                .join("")
                            }

                        </td>


                        <td>

                            ${match.players
                                ?.map(
                                    player =>
                                        `<span class="badge ${
                                            player.result === "WIN"
                                                ? "win"
                                                : "loss"
                                        }">
                                            ${player.score}
                                        </span>`
                                )
                                .join(" ")
                            }

                        </td>


                        <td>
                            ${match.cockQty || 0}
                        </td>


                        <td>
                            ${formatRupiah(
                                match.cockTotal || 0
                            )}
                        </td>


                        <td>

                            ${
                                match.photoUrl
                                    ? `
                                    <img
                                        src="${match.photoUrl}"
                                        style="
                                            width:55px;
                                            height:55px;
                                            object-fit:cover;
                                            border-radius:8px;
                                        "
                                    >
                                    `
                                    : "-"
                            }

                        </td>


                        <td>

                            <button
                                class="btn secondary"
                                onclick="
                                    deleteMatch('${match.id}')
                                ">
                                Hapus
                            </button>

                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>

    `;

}


// ======================================================
// DELETE MATCH
// ======================================================

window.deleteMatch =
    async function(id) {

        if (
            !confirm(
                "Hapus pertandingan ini?"
            )
        )
            return;


        await deleteDoc(
            doc(
                db,
                "badmintonMatches",
                id
            )
        );


        await loadAllData();

        renderMatches();

    };


// ======================================================
// MEMBERS TABLE
// ======================================================

function renderMembers() {

    const container =
        document.getElementById(
            "membersTable"
        );


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>#</th>

                    <th>Nama</th>

                    <th>No. HP</th>

                    <th>Status</th>

                </tr>

            </thead>


            <tbody>

                ${members.map(
                    (member, index) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(member.name)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                member.phone || "-"
                            )}
                        </td>

                        <td>

                            <span class="badge win">
                                ACTIVE
                            </span>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// ======================================================
// CASH SUMMARY
// ======================================================

function buildCashSummary() {

    const result = {};


    members.forEach(member => {

        result[member.id] = {

            id:
                member.id,

            name:
                member.name,

            dues:
                0,

            cockQty:
                0,

            cockCost:
                0,

            cockPaid:
                0

        };

    });


    /*
     * Setiap pertandingan:
     *
     * Total cock dibagi jumlah pemain.
     */

    matches.forEach(match => {

        const players =
            match.players || [];


        if (!players.length)
            return;


        const costPerPlayer =
            (
                Number(match.cockTotal) || 0
            ) /
            players.length;


        const cockPerPlayer =
            (
                Number(match.cockQty) || 0
            ) /
            players.length;


        players.forEach(player => {

            if (!result[player.memberId])
                return;


            result[
                player.memberId
            ].cockQty +=
                cockPerPlayer;


            result[
                player.memberId
            ].cockCost +=
                costPerPlayer;

        });

    });


    /*
     * Pembayaran cock
     */

    payments.forEach(payment => {

        if (
            result[payment.memberId]
        ) {

            result[
                payment.memberId
            ].cockPaid +=
                Number(
                    payment.amount
                ) || 0;

        }

    });


    /*
     * SALDO
     *
     * Positif =
     * anggota masih memiliki saldo
     *
     * Negatif =
     * anggota masih memiliki hutang
     */

    return Object.values(result)
        .map(item => {

            item.balance =
                item.dues +
                item.cockPaid -
                item.cockCost;


            return item;

        })
        .sort(
            (a, b) =>
                Math.abs(b.balance) -
                Math.abs(a.balance)
        );

}


// ======================================================
// CASH TABLE
// ======================================================

function renderCashSummary() {

    const data =
        buildCashSummary();


    const container =
        document.getElementById(
            "cashTable"
        );


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>#</th>

                    <th>Anggota</th>

                    <th>Iuran Kas</th>

                    <th>Jumlah Cock</th>

                    <th>Total Harga Cock</th>

                    <th>Rp Cock Dibayar</th>

                    <th>Saldo</th>

                </tr>

            </thead>


            <tbody>

                ${data.map(
                    (item, index) => `

                    <tr>

                        <td class="rank">
                            ${index + 1}
                        </td>


                        <td>
                            <strong>
                                ${escapeHtml(item.name)}
                            </strong>
                        </td>


                        <td>
                            ${formatRupiah(
                                item.dues
                            )}
                        </td>


                        <td>
                            ${item.cockQty.toFixed(2)}
                        </td>


                        <td>
                            ${formatRupiah(
                                item.cockCost
                            )}
                        </td>


                        <td>
                            ${formatRupiah(
                                item.cockPaid
                            )}
                        </td>


                        <td>

                            <strong class="${
                                item.balance < 0
                                    ? "text-danger"
                                    : ""
                            }">

                                ${formatRupiah(
                                    item.balance
                                )}

                            </strong>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// ======================================================
// GAME STATISTICS
// ======================================================

function buildStatistics() {

    const result = {};


    members.forEach(member => {

        result[member.id] = {

            id:
                member.id,

            name:
                member.name,

            games:
                0,

            wins:
                0,

            losses:
                0

        };

    });


    matches.forEach(match => {

        (
            match.players || []
        ).forEach(player => {

            if (
                !result[player.memberId]
            )
                return;


            result[
                player.memberId
            ].games++;


            if (
                player.result === "WIN"
            ) {

                result[
                    player.memberId
                ].wins++;

            } else {

                result[
                    player.memberId
                ].losses++;

            }

        });

    });


    return Object.values(result)

        .map(item => {

            item.winRate =
                item.games > 0
                    ? (
                        item.wins /
                        item.games
                    ) * 100
                    : 0;

            return item;

        })

        .sort(
            (a, b) =>
                b.winRate -
                a.winRate
        );

}


// ======================================================
// STATISTICS TABLE
// ======================================================

function renderStatistics() {

    const data =
        buildStatistics();


    const container =
        document.getElementById(
            "statisticsTable"
        );


    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>#</th>

                    <th>Nama Anggota</th>

                    <th>Permainan</th>

                    <th>Menang</th>

                    <th>Kalah</th>

                    <th>Win %</th>

                </tr>

            </thead>


            <tbody>

                ${data.map(
                    (item, index) => `

                    <tr>

                        <td class="rank">
                            ${index + 1}
                        </td>


                        <td>
                            <strong>
                                ${escapeHtml(
                                    item.name
                                )}
                            </strong>
                        </td>


                        <td>
                            ${item.games}
                        </td>


                        <td>
                            ${item.wins}
                        </td>


                        <td>
                            ${item.losses}
                        </td>


                        <td>

                            <strong>
                                ${item.winRate.toFixed(1)}%
                            </strong>

                        </td>

                    </tr>

                `
                ).join("")}

            </tbody>

        </table>

    `;

}


// ======================================================
// DASHBOARD
// ======================================================

function renderDashboard() {

    document
        .getElementById(
            "totalMembers"
        )
        .textContent =
        members.length;


    document
        .getElementById(
            "totalMatches"
        )
        .textContent =
        matches.length;


    const totalCock =
        matches.reduce(
            (sum, match) =>
                sum +
                (
                    Number(
                        match.cockQty
                    ) || 0
                ),
            0
        );


    const totalCost =
        matches.reduce(
            (sum, match) =>
                sum +
                (
                    Number(
                        match.cockTotal
                    ) || 0
                ),
            0
        );


    document
        .getElementById(
            "totalCock"
        )
        .textContent =
        totalCock;


    document
        .getElementById(
            "totalCockCost"
        )
        .textContent =
        formatRupiah(
            totalCost
        );


    renderRecentMatches();

    renderTopPlayers();

}


// ======================================================
// RECENT MATCHES
// ======================================================

function renderRecentMatches() {

    const container =
        document.getElementById(
            "recentMatches"
        );


    const recent =
        [...matches]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            )
            .slice(0, 5);


    if (!recent.length) {

        container.innerHTML =
            "<p>Belum ada pertandingan.</p>";

        return;

    }


    container.innerHTML =
        recent.map(match => `

            <div style="
                padding:12px 0;
                border-bottom:
                    1px solid #eee;
            ">

                <strong>
                    ${formatDate(
                        match.date
                    )}
                </strong>

                <div style="
                    margin-top:5px;
                    color:#777;
                    font-size:12px;
                ">

                    ${(
                        match.players || []
                    )
                    .map(
                        player =>
                            `${escapeHtml(
                                player.name
                            )} ${player.score}`
                    )
                    .join(" vs ")}

                </div>

            </div>

        `).join("");

}


// ======================================================
// TOP PLAYERS
// ======================================================

function renderTopPlayers() {

    const container =
        document.getElementById(
            "topPlayers"
        );


    const data =
        buildStatistics()
            .filter(
                item =>
                    item.games > 0
            )
            .slice(0, 5);


    if (!data.length) {

        container.innerHTML =
            "<p>Belum ada statistik.</p>";

        return;

    }


    container.innerHTML =
        data.map(
            (item, index) => `

            <div style="
                display:flex;
                justify-content:space-between;
                padding:12px 0;
                border-bottom:
                    1px solid #eee;
            ">

                <div>

                    <strong>
                        ${index + 1}.
                        ${escapeHtml(
                            item.name
                        )}
                    </strong>

                    <div style="
                        font-size:11px;
                        color:#888;
                    ">
                        ${item.games} permainan
                    </div>

                </div>


                <strong>
                    ${item.winRate.toFixed(1)}%
                </strong>

            </div>

        `
        ).join("");

}


// ======================================================
// HELPERS
// ======================================================

function formatRupiah(number) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(number || 0);

}


function formatDate(date) {

    if (!date)
        return "-";


    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(
        new Date(date)
    );

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[char])
        );

}
