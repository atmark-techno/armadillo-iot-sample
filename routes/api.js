var express = require('express');
var pg = require('pg');
var router = express.Router();
var db_config = process.env.DATABASE_URL;
var Pusher = require('pusher');
var utils = require('../utils');
var bodyParser = require('body-parser');

var pusher = new Pusher({
    appId: process.env.PUSHER_APPID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET
});

router.post('/series', function (req, res) {
    console.log('post:/api/series');
    if ((process.env.CLIENT_ACCESS_TOKEN == null) ||
	(process.env.CLIENT_ACCESS_TOKEN != req.param('token'))) {
        res.status(401).end();
	return;
    }

    var value = req.body.value;
    var uid = req.body.uid;
    var created_at = req.body.created_at;
    var lat = req.body.latitude;
    var lng = req.body.longitude;


    pg.connect(db_config, function (err, client, done) {

        var query = 'INSERT INTO series(uid, value, created_at) VALUES($1, $2, $3);';
        client.query(query, [uid, value, created_at], function (err, result) {
            done();
            if (err) {
                console.log('Insert A Record Error: ' + err);
                res.status(500).end();
            } else {
                res.status(200).end();
            }
        });

        var query = 'SELECT id FROM locations WHERE uid = $1;';
        client.query(query, [uid], function (err, result) {
            done();
            if (err) {
                console.log('Insert A Record Error: ' + err);
                res.status(500).end();
            } else {
                if (result.rows.length == 0) {
                    var query = 'INSERT INTO locations(uid, latitude, longitude) VALUES($1, $2, $3);';
                    client.query(query, [uid, lat, lng], function (err, result) {
                        done();
                        if (err) {
                            console.log('Insert Error: ' + err);
                            res.status(500).end();
                        } else {
                            res.status(200).end();
                        }
                    });
                } else {
                    var query = 'UPDATE locations SET latitude = $1, longitude = $2 WHERE id = $3;';
                    client.query(query, [lat, lng, result.rows[0].id], function (err, result) {
                        done();
                        if (err) {
                            console.log('Update Error: ' + err);
                            res.status(500).end();
                        } else {
                            res.status(200).end();
                        }
                    });

                }

            }
        });
    });
});

router.get('/series', function (req, res) {
    console.log('get:/api/series');

    pg.connect(db_config, function (err, client, done) {

        var result = utils.create_query(req.query);
        client.query(result[0], result[1], function (err, result) {
            done();
            if (err) {
                console.log('Query Series Error: ' + err);
                res.status(500).end();
            } else {
                res.json(result.rows);
            }
        });
    });
});

router.delete('/series', function (req, res) {
    console.log('delete:/api/series');

    if ((process.env.CLIENT_DELETE_TOKEN == null) ||
	(process.env.CLIENT_DELETE_TOKEN != req.param('token'))) {
        res.status(401).end();
	return;
    }

    var rollback = function(client, done) {
	client.query('ROLLBACK', function (err) {
	    res.status(500).end();
	    return done(err);
	});
    }

    pg.connect(db_config, function (err, client, done) {
	if (err) {
	    res.status(500).end();
	    return;
	}

	client.query('BEGIN', function (err) {
	    if (err) return rollback(client, done);

	    client.query('DELETE from series', function (err) {
		if (err) return rollback(client, done);

		client.query('DELETE from locations', function (err) {
		    if (err) return rollback(client, done);

		    client.query('COMMIT', function (err) {
			if (err) return rollback(client, done);

                        done();
			res.status(200).end();
		    });
		});
	    });
	});
    });

});

router.get('/pusher', function (req, res) {
    console.log('get:/api/pusher');

    var uid = req.query.uid;
    var mode = req.query.mode; // mode is on or off
    pusher.trigger(uid, 'button', {"value": mode});
    res.status(200).end();
});


router.get('/locations', function (req, res) {
    console.log('get:/api/locations');

    var nelat = req.query.neLat,
        nelng = req.query.neLng,
        swlat = req.query.swLat,
        swlng = req.query.swLng;

    pg.connect(db_config, function (err, client, done) {
        var query = 'SELECT * FROM locations WHERE ';
        var params = null;
        if (nelng > swlng) {
            params = [swlng, nelng, nelat, swlat];
            query += '(longitude > $1 AND longitude < $2) AND (latitude <= $3 AND latitude >= $4)';
        } else {
            query += 'longitude <= $1 AND latitude >= $2) AND (latitude <= $3 AND latitude >= $4)';
            params = [swlng, nelng, nelat, swlat];
        }

        client.query(query, params, function (err, result) {
            done();
            if (err) {
                console.log('Record Error: ' + err);
                res.status(500).end();
            } else {
                res.json(result.rows);
            }
        });
    });
});

module.exports = router;
