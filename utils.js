module.exports = {


    create_query: function(params) {
        var result = new Array();

        var uid = params.uid;
        var year = params.year;
        var month = params.month;
        var day = params.day;

        if(year === undefined) {
            result[0] = "SELECT uid, value, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at FROM series WHERE uid = $1 ORDER BY created_at DESC LIMIT 1;";
            result[1] = [uid];
        } else {
            var start = '' + year + '-' + month + '-' + day + ' 00:00:01';
            var end = '' + year + '-' + month + '-' + day + ' 23:59:20';
            result[0] = "SELECT uid, value, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at FROM series WHERE created_at >= $1 AND created_at < $2 AND uid = $3 ORDER BY created_at;";
            result[1] = [start, end, uid];
        }
        return result;
    },


    one_month_param: function (year, month, uid) {
        var start = '' + year + '-' + month + '-01';
        var end;
        if (month == '12') {
            year = parseInt(year) + 1;
            end = '' + year + '-01-01';
        } else {
            month = parseInt(month) + 1;
            end = year + '-' + month + '-01';
        }
        return [start, end, uid];
    }
};

