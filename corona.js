// required modules
const cheerio = require('cheerio');
const console = require('clim')('corona');
const express = require('express');
const mongojs = require('mongojs');
const request = require('request');

// app bootstrap
const app = express();
const devMode = false;

/*
 * Get PA county of interest corona stats
 * Action: GET
 * Params: none
 */
app.get('/nodejs/corona', function (req, res) {
    if (devMode) {
        res.header('Access-Control-Allow-Origin', 'http://localhost:5500');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }

    const db = mongojs('corona');
    const collection = db.collection('collection');

    // query the database for all stats
    var result = {};
	collection.find().sort({date: 1}, function(err, doc) {
		// handle exception from query
		if (err) {
			responses.sendError(res, {
				desc: responses.exceptions.databaseError,
				code: 500,
				error: err
			});
			return;
		}

		// if we got a result from the db, write out the record
		if (doc) {
			result = doc;
			responses.sendSuccess(res, result, true);
		} else {
			responses.sendError(res, {
				desc: responses.exceptions.noResultsError,
				code: 500,
				error: err
			});
		}
    });

	// log usage
	console.log(req.headers['x-forwarded-for'] + '\n' + req.headers['user-agent'] + '\n');
});

/*
 * Update PA county of interest corona stats
 * Action: POST
 * Params: none
 */
app.post('/nodejs/corona', function (req, res) {
    const countiesOfInterest = ['Adams', 'Cumberland', 'Dauphin', 'Franklin', 'Lancaster', 'Lebanon', 'Perry', 'York'];
    const getOptions = {
		url: 'https://www.health.pa.gov/topics/disease/coronavirus/Pages/Cases.aspx'
    };
    const db = mongojs('corona');
    const collection = db.collection('collection');
    
    // query the database to see if stats exist for today
    collection.findOne({date: utils.today('MM/dd/yyyy')}, function(err, doc) {
        // handle exception from query
        if (err) {
            responses.sendError(res, {
                desc: responses.exceptions.databaseError,
                code: 500,
                error: err
            });
            return;
        }

        // if we got a result from the db, return
        if (doc) {
            responses.sendError(res, {
                desc: responses.exceptions.resultsExistError,
                code: 500,
                error: err
            });
        } else {
            // get the remote stats data and parse it
            var results = [];
            request(getOptions, function (error, response, html) {
                if (!error && response.statusCode === 200) {
                    const $ = cheerio.load(html);
                    
                    // Department of Health page DOM is a mess, not a great way to identify the table.
                    // It was previously the last table in the #page element, it no longer is. 
                    // Keying on the specific table index now, likely to break again as they tweak.
                    $('#page table').each(function(tableIndex, table) {
                        if (tableIndex !== 4) {
                            return;
                        }
                        const $table = $(table);

                        $table.find('tbody > tr').each(function(rowIndex, row) {
                            const $row = $(row);
                            var countyFound = false;
                            var countyStats;

                            $row.find('td').each(function(cellIndex, cell) {
                                const $cell = $(cell);
                                var cellValue = utils.trim($cell.text());
                                
                                if (countiesOfInterest.indexOf(cellValue) > -1) {
                                    countyStats = { 
                                        date: utils.today('MM/dd/yyyy'),
                                        name: cellValue
                                    };
                                    countyFound = true;

                                } else if (countyFound) {
                                    countyStats.cases = cellValue;
                                    countyFound = false;

                                    results.push(countyStats);                            
                                }
                            });
                        });
                    });
                } else {
                    responses.sendError(res, {
                        desc: responses.exceptions.remoteError,
                        code: 500,
                        response: response,
                        error: error
                    });
                    return;
                }
                
                // persist to db
                collection.insert(results, function(err, doc) {
                    // handle exception from save
                    if (err) {
                        responses.sendError(res, {
                            desc: responses.exceptions.databaseError,
                            code: 500,
                            error: err
                        });
                        return;
                    }

                    responses.sendSuccess(res, doc, false);
                    // log the persisted stats
                    console.log(doc);
                });
            });            
        }
    });
});

/*
 * Populate the historical data.
 * Action: GET
 * Params: none
 */
app.get('/nodejs/corona/populate', function (req, res) {
    const db = mongojs('corona');
    const collection = db.collection('collection');

    // persist to db
    const results = [
        // {name: 'Adams', cases: 263, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Cumberland', cases: 657, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Dauphin', cases: 1404, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Franklin', cases: 785, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Lancaster', cases: 3301, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Lebanon', cases: 997, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'Perry', cases: 64, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')},
        // {name: 'York', cases: 1038, date: utils.formatDate(new Date('06/04/2020'), 'MM/dd/yyyy')}
    ];
    console.log(results);
    collection.insert(results, function(err, doc) {
        // handle exception from save
        if (err) {
            responses.sendError(res, {
                desc: responses.exceptions.databaseError,
                code: 500,
                error: err
            });
            return;
        }

        responses.sendSuccess(res, doc, true);
        // log the persisted stats
        console.log(doc);
    });
});

var responses = {

	exceptions: {
		remoteError: 'no response from remote server',
		databaseError: 'could not communicate with database',
		hostnameError: 'hostname not found',
        queryError: 'missing query string parameter(s)',
        noResultsError: 'no results found from query',
        resultsExistError: 'results already exist for today'
	},

    // send successful JSON response
    sendSuccess: function(res, data, cached) {
        var headers = {
            'Content-Type': 'application/json'
        };

        if (cached) {
            headers['Cache-Control'] = 'max-age=300';
        }

        res.writeHead(200, headers);
        res.end(JSON.stringify(data));
    },

    // send error JSON response
    sendError: function(res, error) {
        var headers = {
            'Content-Type': 'application/json'
        };

        // capture the current date/time
        var timestamp = new Date();
        error.timestamp = timestamp;

        // stringify what was passed in to log and send as the response
        var errorString = JSON.stringify(error);
        res.writeHead(error.code, headers);
        res.end(errorString);
        console.error(errorString + '\n');
    }
};

var utils = {
	// type safe lowercase function
	// returns a lowercased string
	toLower: function(s) {
		// only invoke toLowerCase() if a string was passed in
		if (typeof s === 'string') {
			s = s.toLowerCase();
		}
		return s;
	},

    // type safe trim function
    // returns a trimmed string with continuous spaces replaced with a single space
    trim: function(s) {
        // only invoke trim() if a string was passed in
        if (typeof s === 'string') {
            s = s.trim().replace('\n', '').replace('\t', '').replace(/\s+/g,' ');
        }
        return s;
    },

    // parse and return the requested date format
    formatDate: function(date, format) {
		const dateParts = {
			// month (zero based)
			'M+' : date.getMonth() + 1,
			// day
			'd+' : date.getDate(),
			// hour
			'h+' : date.getHours(),
			// minute
			'm+' : date.getMinutes(),
			// second
			's+' : date.getSeconds(),
			// quarter
			'q+' : Math.floor((date.getMonth() + 3) / 3),
			// millisecond
			'S'  : date.getMilliseconds()
		};

		if (/(y+)/.test(format)) {
			format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
		}

		for (var part in dateParts) {
			if (new RegExp('(' + part + ')').test(format)) {
				format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? dateParts[part] : ('00' + dateParts[part]).substr(('' + dateParts[part]).length));
			}
		}

		return format;
    },
    
    // helper function to return today's date in a format
    today: function(format) {
        return utils.formatDate(new Date(), format);
    }
};

// app startup
if (devMode) {
    app.listen(4000, function () {
        console.log('app listening on port 4000!');
    });
} else {
    app.listen(process.env.PORT);
}
