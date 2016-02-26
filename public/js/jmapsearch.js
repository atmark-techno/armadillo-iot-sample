jQuery(function ($) {
    // (1)
    var ns = google.maps,
        listUrl  = "/api/locations",// 場所情報用URL
        detailUrl  = "not_implemented",// 詳細情報用URL
        markers = [],// マーカーをハッシュのように管理
        mapOptions = {
            zoom: 13,
            center: new ns.LatLng(35.665595, 139.739)
        },
        map = new ns.Map($("#mapDiv")[0], mapOptions);

    // (2) 詳細情報表示
    function detailShow(data) {
        var info;
        if (data.success !== true) {
            return;
        }
        info = data.info;
        // このinfoを使って、店名、住所、電話番号など役立つ情報を表示したりする
        console.log(info.id);
    }

    // (3) 詳細情報の情報取得
    function getDetailInfo(id) {
        $.ajax({
            url: detailUrl,
            dataType: "json",
            data: {
                id: id
            },
            type: "GET"
        }).done(detailShow);
    }

    // (4) マーカーを設置する
    function placeMarker(id, info) {
        var position = new ns.LatLng(info.latitude, info.longitude),
            marker = new ns.Marker({position: position, map: map, title: info.uid});

        var contentString="<dl id='infowin1'><dt>" + info.uid + "</dt><dd>詳細は<a href='/cockpit?uid=" + info.uid + "'>こちら</a></dd></dl>";
        var infowindow=new google.maps.InfoWindow({
            content: contentString
        });


        ns.event.addListener(marker, 'click', function () {
            infowindow.open(map,marker);
        });
        markers[id] = marker;
    }

    // (5) 一覧アイコン表示
    function listAll(data) {
        var id, i, newLen,
            shops = [],
            newStore = [];	// 新規に取得したIDをハッシュのように管理


        shops = data;
        newLen = shops.length;

        for (i = 0; i < newLen; i = i + 1) {
            id = shops[i].uid;
            newStore[id] = 1;
        }

        // 画面から消えたマーカーを削除
        for (id in markers) {
            if (!newStore[id]) {
                markers[id].setMap(null);
                delete markers[id];
            }
        }
        // 新しく追加されたマーカーを追加
        for (i = 0; i < newLen; i = i + 1) {
            id = shops[i].uid;
            if (!markers[id]) {
                placeMarker(id, shops[i]);
            }
        }
    }

    // (6) AJAXで現在の地図における対象物一覧を取得する
    function getTarget() {
        var latLngBounds = map.getBounds(),
            northEast = latLngBounds.getNorthEast(),
            southWest = latLngBounds.getSouthWest();

        $.ajax({
            url: listUrl,
            dataType: "json",
            data: {
                neLat: northEast.lat(),
                neLng: northEast.lng(),
                swLat: southWest.lat(),
                swLng: southWest.lng()
            },
            type: "GET"
        }).done(listAll);
    }

    // (7) イベント設定
    ns.event.addListener(map, 'idle', getTarget);

});