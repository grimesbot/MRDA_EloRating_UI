function populateRankingDates() {
    let months = [3,6,9,12];
    let currentYear = new Date().getFullYear();
    let years = [currentYear - 1, currentYear, currentYear + 1];
    let wednesdays = new Map();
    let smallestDaysDiff = 365*2;
    let selectedWednesday = null;

    years.forEach(year => {
        months.forEach(month => {
            let searchDate = new Date(year,month-1,1);
            while (searchDate.getDay() !== 3) {
                searchDate.setDate(searchDate.getDate() + 1);
            }

            let daysAge = daysDiff(searchDate,new Date());

            if (daysAge <= 365 && daysAge >= -90) {
                let wedString = getStandardDateString(searchDate);
                wednesdays.set(wedString, `Q${months.indexOf(month) + 1} ${year} (${wedString})`);
                
                if (Math.abs(daysAge) < smallestDaysDiff)
                    {
                        smallestDaysDiff = Math.abs(daysAge);
                        selectedWednesday = wedString;
                    }
            }         
        });
    });

    let $dropdown = $("#date");

    wednesdays.forEach((text, wedString) => {
        $dropdown.append($("<option />").val(wedString).text(text));
    });

    let todayString = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
    $dropdown.append($("<option />").val(todayString).text("Today (" + todayString + ")"));
    $dropdown.val(selectedWednesday);
}

function displayRankingChart(teamsArray, calcDate) {

    let rankingChart = Chart.getChart("ratingsChart");
    if (rankingChart != undefined) {
        rankingChart.destroy();
    }

    let dateCalc = calcDate ? new Date(calcDate) : new Date();
    let dateMax = getStandardDateString(dateCalc);
    dateCalc.setFullYear(dateCalc.getFullYear() - 1)
    dateCalc.setDate(dateCalc.getDate() + 1);
    let dateMin = getStandardDateString(dateCalc);

    let datasets = [];

    teamsArray.sort((a, b) => a.rankingSort - b.rankingSort).forEach(team => {
        if (team.chart) {
            datasets.push({
                label: team.teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " "),
                data: Array.from(team.eloRatingHistory, ([date, elo]) => ({ x: new Date(date), y: elo, teamName: team.teamName })),
                //data:  Array.from(team.gameHistory.filter((game) => game.eloRatings[team.teamId]), (game) => ({ x: new Date(game.date), y: game.eloRatings[team.teamId], teamName: team.teamName })),
                showLine: true
            });
        }
    });

    rankingChart = new Chart(document.getElementById("ratingsChart"), {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                scales: {
                    x: {
                        type: 'time',
                        min: new Date(dateMin),
                        max: new Date(dateMax)
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return context[0].raw.teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " ");
                            },
                            label: function(context) {
                                return getStandardDateString(context.raw.x) + ": " + context.raw.y.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
}

function averageFromArray(array) {
    var total = 0;
    for(var i = 0; i < array.length; i++) {
        total += array[i];
    }
    return total / array.length;
}

function meanAbsoluteLogErrorPercent(absLogErrorArray) {
    let meal = averageFromArray(absLogErrorArray);
    let errorPct = (Math.exp(meal) - 1) * 100;
    return errorPct.toFixed(2) + '%';
}

function calculateAndDisplayRankings() {

    let mrdaEloRatingSystem = new MrdaEloRatingSystem(apiTeams);

    mrdaEloRatingSystem.updateRatings(groupedApiGames, $("#date").val());

    mrdaEloRatingSystem.calculateActiveStatus($("#date").val());

    mrdaEloRatingSystem.rankTeams();

    if (mrdaEloRatingSystem.absoluteLogErrors.length > 0)
    {
        let $pctErrorDiv = $('#pctErrorMeal');
        $pctErrorDiv.html("Percent Error using Mean Absolute Log Error: <br />");
        if (mrdaEloRatingSystem.absoluteLogErrors_2024_Q4.length > 0)
            $pctErrorDiv.append("2024 Q4: " + meanAbsoluteLogErrorPercent(mrdaEloRatingSystem.absoluteLogErrors_2024_Q4) + "<br />");                
        if (mrdaEloRatingSystem.absoluteLogErrors_2025_Q1.length > 0)
            $pctErrorDiv.append("2025 Q1: " + meanAbsoluteLogErrorPercent(mrdaEloRatingSystem.absoluteLogErrors_2025_Q1) + "<br />");
        if (mrdaEloRatingSystem.absoluteLogErrors_2025_Q2.length > 0)
            $pctErrorDiv.append("2025 Q2: " + meanAbsoluteLogErrorPercent(mrdaEloRatingSystem.absoluteLogErrors_2025_Q2) + "<br />");
        if (mrdaEloRatingSystem.absoluteLogErrors_2025_Q3.length > 0)
            $pctErrorDiv.append("2025 Q3: " + meanAbsoluteLogErrorPercent(mrdaEloRatingSystem.absoluteLogErrors_2025_Q3) + "<br />");
        $pctErrorDiv.append("Total: " + meanAbsoluteLogErrorPercent(mrdaEloRatingSystem.absoluteLogErrors));
    }

    displayRankingChart(Object.values(mrdaEloRatingSystem.mrdaTeams), $("#date").val());

    let regenerate = DataTable.isDataTable('#mrdaEloRatings');

    if (regenerate)
        $('#mrdaEloRatings').DataTable().clear().destroy();

    new DataTable('#mrdaEloRatings', {
        columns: [
            { name: 'rankingSort', data: 'rankingSort', visible: false},
            { title: 'Position', data: 'ranking', className: 'dt-teamDetailsClick' },
            { title: 'Team', data: 'teamName', className: 'dt-teamDetailsClick' },
            { title: 'Elo Rating', data: 'eloRating', render: function (data, type, full) { return data.toFixed(2); }, className: 'dt-teamDetailsClick' },
            { title: 'Games Count',  data: 'activeStatusGameCount', className: 'dt-teamDetailsClick'},
            { title: 'Postseason Eligible', data: 'postseasonEligible', render: function (data, type, full) { return data ? 'Yes' : 'No'; }, className: 'dt-teamDetailsClick'},
            { title: "Chart", data: 'chart', render: function (data, type, full) { return "<input type='checkbox' class='chart' " + (data ? "checked" : "") + "></input>"; }}
        ],
        data: Object.values(mrdaEloRatingSystem.mrdaTeams),
        paging: false,
        searching: false,
        info: false,
        order: {
            name: 'rankingSort',
            dir: 'asc'
        },
        ordering: {
            handler: false
        }
    });
    
    if (!regenerate) {
        $("#mrdaEloRatingsContainer").on('change', 'input.chart', function (e) {
            let tr = e.target.closest('tr');
            let dt = $('#mrdaEloRatings').DataTable();
            let row = dt.row(tr);
            let team = row.data();
            team.chart = $(this).prop('checked');
            displayRankingChart(dt.rows().data().toArray(), $("#date").val());
        });
    }
}

function teamDetailsModal() {
    var teamChart;
    var teamGameHistoryDt;
    let $teamDetailModal = $('#teamDetailModal');

    $('#mrdaEloRatingsContainer').on('click', 'td.dt-teamDetailsClick', function (e) {
        let tr = e.target.closest('tr');
        let row = $('#mrdaEloRatings').DataTable().row(tr);
        let team = row.data();

        $('#teamName').text(team.teamName);
        $('#teamEloRating').text(team.eloRating.toFixed(2));

        teamChart = new Chart(document.getElementById("teamChart"), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Games',
                    data: Array.from(team.gameHistory.filter((game) => game.eloRatings[team.teamId]), (game) => ({ 
                        x: new Date(game.date), 
                        y: game.eloRatings[team.teamId], 
                        title: getStandardDateString(game.date) + (game.homeTeamId == team.teamId ? 
                            " vs. " + apiTeams[game.awayTeamId].teamName : " @ " + apiTeams[game.homeTeamId].teamName),
                        label: "Elo Change: " + (game.eloAdjustments[team.teamId] > 0 ? "+" : "") + game.eloAdjustments[team.teamId].toFixed(2) })),
                    showLine: false
                }, {
                    label: 'Elo Rating',
                    data: Array.from(team.eloRatingHistory, ([date, elo]) => ({ x: new Date(date), y: elo, title: getStandardDateString(date), label: "Elo Rating: " + elo.toFixed(2) })),
                    showLine: true
                }],
            },
            options: {
                scales: {
                    x: {
                        type: 'time',
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return context[0].raw.title;
                            },
                            label: function(context) {
                                return context.raw.label;
                                return getStandardDateString(context.raw.x) + ": " + context.raw.y.toFixed(2);
                            }
                        }
                    }
                }
            }
        });

        teamGameHistoryDt = new DataTable('#teamGameHistory', {
            columns: [
                { name: 'date', data: 'date'},
                { data: 'score' },
                { data: 'expected'},
                { data: 'actual'},
                { data: 'eloAdjustment', render: function (data, type, full) { return data ? (data > 0 ? "+" : "") + data.toFixed(2) : ""; }, className: 'border-left'},
                { data: 'eloRating', render: function (data, type, full) { return data ? data.toFixed(2) : ""; }}
            ],
            data: Array.from(team.gameHistory, (game) => ({ 
                date: getStandardDateString(game.date),
                score: game.scores[team.teamId] + "-" + (game.homeTeamId == team.teamId ? 
                    game.scores[game.awayTeamId] + " vs. " + apiTeams[game.awayTeamId].teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " ") 
                    : game.scores[game.homeTeamId] + " @ " + apiTeams[game.homeTeamId].teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " ")),
                expected: game.homeTeamId == team.teamId ? game.expected[game.homeTeamId].toFixed(2) + "-" + game.expected[game.awayTeamId].toFixed(2) 
                    : game.expected[game.awayTeamId].toFixed(2) + "-" + game.expected[game.homeTeamId].toFixed(2),
                actual: game.forfeit ? "" : (game.homeTeamId == team.teamId ? game.actual[game.homeTeamId].toFixed(2) + "-" + game.actual[game.awayTeamId].toFixed(2) 
                    : game.actual[game.awayTeamId].toFixed(2) + "-" + game.actual[game.homeTeamId].toFixed(2)),
                eloAdjustment: game.forfeit ? "" : game.eloAdjustments[team.teamId],
                eloRating: game.forfeit ? "" : game.eloRatings[team.teamId]
            })),
            lengthChange: false,
            searching: false,
            info: false,
            order: {
                name: 'date',
                dir: 'desc'
            },
            ordering: {
                handler: false
            },
        });

        $teamDetailModal.modal('show');
    });

    $teamDetailModal.on('hidden.bs.modal', function (event) {
        $('#teamName').text('');
        $('#teamEloRating').text('');
        teamChart.destroy();
        teamGameHistoryDt.clear();
        teamGameHistoryDt.destroy();
    });

}

function setupConfigInputs(changeCallback) {
    $("#config input").each(function() {
        let $this = $(this);
        let val = config[$this.attr('id')];
        if ($this.attr('type') == 'checkbox') {
            $this.prop('checked', val);
        } else {
            $this.val(val);
        }
    }).on('change', function() {
        let $this = $(this);
        if ($this.attr('type') == 'checkbox') {
            config[$this.attr('id')] = $this.prop('checked');
        } else {
            config[$this.attr('id')] = parseFloat($this.val());
        }
        if ($(this).data('regenreateApiGames'.toLowerCase()))
            buildTeamsAndGames(changeCallback);
        else
            changeCallback();
    });
}

function setupApiGames() {
    var apiGamesDt = new DataTable('#apiGames', {
            columns: [
                { title: "Date", name: 'date', data: 'date', render: getStandardDateString},
                { title: "Home Team", data: 'homeTeamId', render: function (data) { return apiTeams[data].teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " "); } },
                { title: "Home Score", data: 'homeTeamScore', render: function(data, type, full) { return data + (full.forfeit ? "*" : ""); }},
                { title: "Away Score", data: 'awayTeamScore', render: function(data, type, full) { return data + (full.forfeit ? "*" : ""); }} ,
                { title: "Away Team", data: 'awayTeamId', render: function (data) { return apiTeams[data].teamName.replaceAll("Roller Derby", "").replaceAll("Derby", "").replaceAll("  ", " "); } },
                { title: "Event Name", data: 'eventName'},
                { title: "Type", render: function (data, type, full) { return full.championship ? "Championship" : full.qualifier ? "Qualifier" : "Regular Season"; }},
                { title: "Validated", data: 'validated'},
                { title: "Excluded", render: function (data, type, full) { return "<input type='checkbox' class='excluded'></input>"; }}
            ],
            data: [...groupedApiGames.values()].flat(1),
            lengthChange: false,
            order: {
                name: 'date',
                dir: 'desc'
            }
        });

    $("#apiGames").on('change', 'input.excluded', function (e) {
        let tr = e.target.closest('tr');
        let row = apiGamesDt.row(tr);
        let game = row.data();
        game.excluded = $(this).prop('checked');
        calculateAndDisplayRankings();
    });
}

function setupApiTeams() {
    var apiTeamsDt = new DataTable('#apiTeams', {
            columns: [
                { title: "Team", data: 'teamName'},
                { title: "Distance Clause Applies", data: 'distanceClauseApplies'},
                { title: "Initial Rating", data: 'initialRating', render: function (data, type, full) { return "<div class='hiddenInitialRating' style='display: none;'>" + data + "</div><input type='number' class='initialRating' step='0.1' min='1' value='" + data + "'></input>"; }}
            ],
            data: Object.values(apiTeams),
            lengthChange: false
        });

    $("#apiTeams").on('change', 'input.initialRating', function (e) {
        let tr = e.target.closest('tr');
        let row = apiTeamsDt.row(tr);
        let team = row.data();
        team.initialRating = parseFloat($(this).val());
        $(tr).find('.hiddenInitialRating').val(team.initialRating);
        calculateAndDisplayRankings();
    });
}

async function main() {

    //document.documentElement.setAttribute('data-bs-theme', (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    populateRankingDates();

    await buildTeamsAndGames();

    calculateAndDisplayRankings();

    teamDetailsModal();

    setupConfigInputs(calculateAndDisplayRankings);

    setupApiGames();

    setupApiTeams();

    $("#date").on( "change", calculateAndDisplayRankings );
}

window.addEventListener('load', main);