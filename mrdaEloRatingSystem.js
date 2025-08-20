class MrdaGame {
    constructor(apiGame) {
        this.date = apiGame.date;
        this.homeTeamId = apiGame.homeTeamId;
        this.awayTeamId = apiGame.awayTeamId;
        this.scores = {};
        this.scores[this.homeTeamId] = apiGame.homeTeamScore;
        this.scores[this.awayTeamId] = apiGame.awayTeamScore;        
        this.forfeit = apiGame.forfeit;
        this.eventName = apiGame.eventName;
        this.championship = apiGame.championship;
        this.qualifier = apiGame.qualifier;
        this.expected = {};
        this.actual = {};
        this.eloAdjustments = {};
        this.eloRatings = {};
    }
}

class MrdaTeam {
    constructor(apiTeam) {
        this.teamId = apiTeam.teamId;
        this.teamName = apiTeam.teamName;
        this.distanceClauseApplies = apiTeam.distanceClauseApplies;
        this.gameHistory = []
        this.activeStatusGameCount = 0;
        this.eloRating = apiTeam.initialRating;
        this.eloRatingHistory = new Map();
        this.ranking = null;
        this.rankingSort = null;
        this.postseasonEligible = false;
        this.chart = false;
    }
}

function getStandardDateString(date) {
    let dt = new Date(date);
    return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

// Define the number of milliseconds in one day
const dayInMilliseconds = 1000 * 60 * 60 * 24;

function daysDiff(startDate, endDate) {
    
    // Convert to dates and remove time
    let dateStart = new Date(new Date(startDate).toDateString());
    let dateEnd = new Date(new Date(endDate).toDateString());
    
    // Calculate the difference in milliseconds
    let diffInMilliseconds = dateEnd.getTime() - dateStart.getTime();

    // Calculate the number of days and round to the nearest whole number
    return Math.round(diffInMilliseconds / dayInMilliseconds);;
}

const q4_2024_deadline = new Date (2024, 12 - 1, 4);
const q1_2025_deadline = new Date (2025, 3 - 1, 5);
const q2_2025_deadline = new Date (2025, 6 - 1, 4);
const q3_2025_deadline = new Date (2025, 9 - 1, 3);

class MrdaEloRatingSystem {
    constructor(apiTeams) {
        this.mrdaTeams = {};
        Object.keys(apiTeams).forEach(teamId => this.mrdaTeams[teamId] = new MrdaTeam(apiTeams[teamId]));
        this.absoluteLogErrors = [];
        this.absoluteLogErrors_2025_Q1 = [];
        this.absoluteLogErrors_2025_Q2 = [];        
        this.absoluteLogErrors_2025_Q3 = [];                        
    }

    expectedScore(ra, rb) {
        return 1 / (1 + Math.pow(10, ((rb - ra) / 400)));
    }

    sigmoid_actual_score(scoreA, scoreB) {
        let score_diff = scoreA - scoreB
        return 1 / (1 + Math.exp(-config.sigmoid_steepness * score_diff)); // Sigmoid function for proportional scores
    }

    calculateEloAdjustments(apiGame) {
        let mrdaGame = new MrdaGame(apiGame);

        let homeRating = this.mrdaTeams[mrdaGame.homeTeamId].eloRating;
        let awayRating = this.mrdaTeams[mrdaGame.awayTeamId].eloRating;

        mrdaGame.expected[mrdaGame.homeTeamId] = this.expectedScore(homeRating, awayRating);
        mrdaGame.expected[mrdaGame.awayTeamId] = this.expectedScore(awayRating, homeRating);

        if (!mrdaGame.forfeit) {            
            mrdaGame.actual[mrdaGame.homeTeamId] = this.sigmoid_actual_score(mrdaGame.scores[mrdaGame.homeTeamId], mrdaGame.scores[mrdaGame.awayTeamId]);
            mrdaGame.actual[mrdaGame.awayTeamId] = this.sigmoid_actual_score(mrdaGame.scores[mrdaGame.awayTeamId], mrdaGame.scores[mrdaGame.homeTeamId]);

            mrdaGame.eloAdjustments[mrdaGame.homeTeamId] = config.k_factor * (mrdaGame.actual[mrdaGame.homeTeamId] - mrdaGame.expected[mrdaGame.homeTeamId]);
            mrdaGame.eloAdjustments[mrdaGame.awayTeamId] = config.k_factor * (mrdaGame.actual[mrdaGame.awayTeamId] - mrdaGame.expected[mrdaGame.awayTeamId]);
            
            let gameDate = new Date(mrdaGame.date);

            if (gameDate > q4_2024_deadline) {
                let absLogError = Math.abs(Math.log((mrdaGame.expected[mrdaGame.homeTeamId]/mrdaGame.expected[mrdaGame.awayTeamId])/(mrdaGame.scores[mrdaGame.homeTeamId]/mrdaGame.scores[mrdaGame.awayTeamId])));
                this.absoluteLogErrors.push(absLogError);                     
                if (q4_2024_deadline < gameDate && gameDate < q1_2025_deadline)
                    this.absoluteLogErrors_2025_Q1.push(absLogError);
                if (q1_2025_deadline < gameDate && gameDate < q2_2025_deadline)
                    this.absoluteLogErrors_2025_Q2.push(absLogError);
                if (q2_2025_deadline < gameDate && gameDate < q3_2025_deadline)
                    this.absoluteLogErrors_2025_Q3.push(absLogError);
            }
        }
        
        this.mrdaTeams[mrdaGame.homeTeamId].gameHistory.push(mrdaGame);
        this.mrdaTeams[mrdaGame.awayTeamId].gameHistory.push(mrdaGame);

        if (!mrdaGame.forfeit)
            return mrdaGame;
    }

    applyEloAdjustments(games) {
        let teamsWithLastPlayedDt = {};
        games.forEach(game => {
            this.mrdaTeams[game.homeTeamId].eloRating += game.eloAdjustments[game.homeTeamId];
            this.mrdaTeams[game.awayTeamId].eloRating += game.eloAdjustments[game.awayTeamId];

            game.eloRatings[game.homeTeamId] = this.mrdaTeams[game.homeTeamId].eloRating;
            game.eloRatings[game.awayTeamId] = this.mrdaTeams[game.awayTeamId].eloRating;

            teamsWithLastPlayedDt[game.homeTeamId] = getStandardDateString(game.date);
            teamsWithLastPlayedDt[game.awayTeamId] = getStandardDateString(game.date);
        });

        Object.keys(teamsWithLastPlayedDt).forEach(teamId => {
            this.mrdaTeams[teamId].eloRatingHistory.set(teamsWithLastPlayedDt[teamId], this.mrdaTeams[teamId].eloRating);
        });
    }

    updateRatings(groupedApiGames, calcDate) {        
        groupedApiGames.forEach((apiGames, sanctioningId) => {
            let adjustedGames = [];
            apiGames.forEach(game => {
                if(daysDiff(game.date, calcDate) >= 0 && !game.excluded) {
                    let adjustedGame = this.calculateEloAdjustments(game);
                    if (adjustedGame) 
                        adjustedGames.push(adjustedGame);
                }
            });
            this.applyEloAdjustments(adjustedGames);
        });
    }

    calculateActiveStatus(calcDate) {
        Object.values(this.mrdaTeams).forEach(team => {
            team.gameHistory.forEach(game => {
                let ageDays = daysDiff(game.date, calcDate);
                if (ageDays < 0 || ageDays >= 365)
                    return;
                if (game.championship && ageDays >= 183) {
                    //championships do not count for active status past 6 months
                } else if (game.qualifier && ageDays >= 271) {
                    //qualifiers do not count for active status past 9 months
                } else if (game.forfeit 
                    && ((game.scores[game.homeTeamId] > 0 && game.homeTeamId == team.teamId) 
                    || (game.scores[game.awayTeamId] > 0 && game.awayTeamId == team.teamId))) {
                    team.activeStatusGameCount ++;
                } else {
                    team.activeStatusGameCount ++;
                }
            });
        });
    }
    
    rankTeams() {
        let eligibleForRankingTeams = [];
        let unrankedTeams = [];
        Object.values(this.mrdaTeams).forEach(team => {
            if (team.activeStatusGameCount >= 3) {
                eligibleForRankingTeams.push(team);
            } else {
                unrankedTeams.push(team);
            }
        });

        let sortedTeams = eligibleForRankingTeams.sort((a, b) => b.eloRating - a.eloRating );

        for (let i = 0; i < sortedTeams.length; i++) {
            let team = sortedTeams[i];
            team.ranking = i + 1;
            team.rankingSort = i + 1;

            if (team.ranking < 6)
                team.chart = true;

            if (team.activeStatusGameCount >= 5 || team.distanceClauseApplies)
                team.postseasonEligible = true;
        }

        let sortedUnrankedTeams = unrankedTeams.sort((a, b) => b.eloRating - a.eloRating );

        for (let i = 0; i < sortedUnrankedTeams.length; i++) {
            let team = sortedUnrankedTeams[i];
            team.rankingSort = sortedTeams.length + i + 1;
        }
    }
}