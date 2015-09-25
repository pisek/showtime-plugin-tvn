/**
 * Very simple plugin example of browsing music
 */

(function (plugin) {
    var prefix = "tvn",
		baseUrl = "https://api.tvnplayer.pl/api/?v=3.0&authKey=ba786b315508f0920eca1c34d65534cd&platform=ConnectedTV&terminal=Samsung&format=json",
		baseAssetUrl = "http://redir.atmcdn.pl/scale/o2/tvn/web-content/m/",
		userAgent = "Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV; Maple2012) AppleWebKit/534.7 (KHTML, like Gecko) SmartTV Safari/534.7",
		defaultHeaders = { "User-Agent": userAgent};
		
    function createTitle(name, episode, season) {
        var title = name;
        if (season > 0 && episode) {
            if (episode < 10) {
                title += " - S" + season + "E0" + episode;
            } else {
                title += " - S" + season + "E" + episode;
            }
        } else if (episode) {
            title += " (odc. " + episode + ")";
        }
        return title;
    }
    
    function createThumbnailUrl(thumbnail) {
        var url = baseAssetUrl + thumbnail.url + "?";
        url+="type="+thumbnail.type;
        url+="&quality=85";
        url+="&srcmode=0";
        url+="&srcx="+thumbnail.srcx;
        url+="&srcy="+thumbnail.srcy;
        url+="&srcw="+thumbnail.srcw;
        url+="&srch="+thumbnail.srch;
        url+="&dstw=300";
        url+="&dsth=300";
        return url;
    }
    
	function toBitrate(quality)
	{
		switch(quality)
		{
			case "Standard":
				return 750000;
			break;
			case "HD":
				return 3000000;
			break;
			case "Bardzo wysoka":
				return 1500000;
			break;
			case "Wysoka":
				return 1000000;
			break;
			case "Średnia":
				return 500000;
			break;
			case "Niska":
				return 300000;
			break;
			case "Bardzo niska":
				return 200000;
			break;
		}
		return 0;
	}

    plugin.createService("TVN Player", prefix+":start", "video", true, plugin.path + "tvnplayer.png");

    plugin.addURI(prefix+":start", function (page) {
        page.type = "directory";
        page.metadata.title = "TVN Player";

        var url = baseUrl + "&m=mainInfo",
            mainInfoRespone = showtime.httpReq(url),
            mainInfo = showtime.JSONDecode(mainInfoRespone.toString()),
            item,
            i;
        for (i = 0; i < mainInfo.categories.length; i = i + 1) {
            item = mainInfo.categories[i];
            if (item.type == "catalog") {
                page.appendItem(prefix+":" + item.type + ":" + item.id + ":" + item.name, "directory", {
                    title: item.name,
                    icon: createThumbnailUrl(item.thumbnail[0])
                });
            }
        }
        page.loading = false;
    });
    plugin.addURI(prefix+":catalog:(.+):(.+)", function (page, arg, pageTitle) {
		var pageNumber = 1,
			sort = "alfa",
			pageSize = 20;
        page.type = "directory";
        page.metadata.title = pageTitle;
        function loader() {
			page.loading = true;
			var url = baseUrl + "&m=getItems&isUserLogged=0&type=catalog&id="+arg+"&category=0&limit="+pageSize+"&sort="+sort+"&page="+pageNumber,
				mainInfoRespone = showtime.httpReq(url),
				mainInfo = showtime.JSONDecode(mainInfoRespone.toString()),
				i,
				item,
				allItemsCount = mainInfo.count_items;
            page.loading = false;
			for (i = 0; i < mainInfo.items.length; i = i + 1) {
				item = mainInfo.items[i];
				page.appendItem(prefix+":" + item.type + ":" + item.id, "video", {
					title: item.title,
					icon: createThumbnailUrl(item.thumbnail[0])
				});
			}
			if (pageNumber++*pageSize > allItemsCount) {
				return false;
			} else {
				return true;
			}
		}
		
		if(loader()) {
			page.paginator = loader;
		}
    });
    plugin.addURI(prefix+":series:(.+)", function (page, arg) {
        var pageNumber = 1,
			sort = "newest",
			pageSize = 20;
        page.type = "directory";
        function loader() {     
			page.loading = true;
			var url = baseUrl + "&m=getItems&isUserLogged=0&type=series&limit="+pageSize+"&page="+pageNumber+"&sort="+sort+"&id="+arg,
				mainInfoRespone = showtime.httpReq(url),
				mainInfo = showtime.JSONDecode(mainInfoRespone.toString()),
				i,
				item,
				title,
				allItemsCount = mainInfo.count_items;
			page.loading = false;
			for (i = 0; i < mainInfo.items.length; i = i + 1) {
				item = mainInfo.items[i];
				if (item.type_episode == "preview_prepremiere")
				{
					continue;
				}
				title = createTitle(item.title, item.episode, item.season);
				page.appendItem(prefix+":" + item.type + ":" + item.id, "video", {
					title: title,
					description: item.lead,
					duration: item.end_credits_start,
					icon: createThumbnailUrl(item.thumbnail[0])
				});
			}
			if (pageNumber++*pageSize > allItemsCount) {
				return false;
			} else {
				return true;
			}
		}
		if(loader()) {
			page.paginator = loader;
		}
    });
    plugin.addURI(prefix+":episode:(.+)", function (page, arg) {
        var url = baseUrl + "&m=getItem&isUserLogged=0&id="+arg,
            mainInfoRespone = showtime.httpReq(url),
            mainInfo = showtime.JSONDecode(mainInfoRespone.toString()),
            item = mainInfo.item,
            i,
            video,
            title,
            metadata = {};
        if (item.title)
        {
            title = item.title;
        } else {
            title = createTitle(item.serie_title, item.episode, item.season);
        }
        page.metadata.title = title;
        if (item.title && item.serie_title)
        {
			metadata.title = item.serie_title+" - "+item.title;
		}
		else if (item.serie_title)
		{
			metadata.title = item.serie_title;
			metadata.season = item.season;
			metadata.episode = item.episode;
		}
		else
		{
			metadata.title = item.title;
		}
        
        var videos = item.videos.main.video_content,
			videoUrl,
			bitrate = 0,
			currentBitrate = -1;
		if (!videos)
		{
			page.error("Selected video is not available on this platform.");
			return;
		}
        for (i=0; i<videos.length;i = i + 1)
        {
            video = videos[i];
            currentBitrate = toBitrate(video.profile_name)
            if (currentBitrate > bitrate)
            {
				videoUrl = video.url;
				bitrate = currentBitrate;
			}
        }
        var videoUrl = showtime.httpReq(videoUrl).toString();
        metadata.canonicalUrl = prefix+":episode:"+arg;
        metadata.sources = [{ url: videoUrl, bitrate: bitrate }]
        metadata.no_fs_scan = true;
        page.loading = false;
        page.source = "videoparams:"+showtime.JSONEncode(metadata);
        page.type = "video";
    });
})(this);
