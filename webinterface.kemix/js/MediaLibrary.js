/*
 *      Copyright (C) 2005-2013 Team XBMC
 *      http://xbmc.org
 *
 *  This Program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2, or (at your option)
 *  any later version.
 *
 *  This Program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with XBMC; see the file COPYING.  If not, see
 *  <http://www.gnu.org/licenses/>.
 *
 */

var MediaLibrary = function () { this.init(); };
MediaLibrary.prototype = {
  playlists: { },

  init: function () {
    this.bindControls();
    this.getPlaylists();
  },
  bindControls: function () {
    $('#musicLibrary').click(jQuery.proxy(this.musicLibraryOpen, this));
    $('#movieLibrary').click(jQuery.proxy(this.movieLibraryOpen, this));
    $('#tvshowLibrary').click(jQuery.proxy(this.tvshowLibraryOpen, this));
    $('#overlay').click(jQuery.proxy(this.hideOverlay, this));
    $(window).resize(jQuery.proxy(this.updatePlayButtonLocation, this));
    $(document).on('keydown', jQuery.proxy(this.handleKeyPress, this));
    $(document).on('contextmenu', jQuery.proxy(this.handleContextMenu, this));
  },
  resetPage: function () {
    $('#musicLibrary').removeClass('selected');
    $('#movieLibrary').removeClass('selected');
    $('#tvshowLibrary').removeClass('selected');
    this.hideOverlay();
  },
  replaceAll: function (haystack, needle, thread) {
    return (haystack || '').split(needle || '').join(thread || '');
  },
  getPlaylists: function () {
    xbmc.rpc.request({
      'context': this,
      'method': 'Playlist.GetPlaylists',
      'timeout': 3000,
      'success': function (data) {
        if (data && data.result && data.result.length > 0) {
          $.each($(data.result), jQuery.proxy(function (i, item) {
            this.playlists[item.type] = item.playlistid;
          }, this));
        }
      },
      'error': function (data, error) {
        xbmc.core.displayCommunicationError();
        setTimeout(jQuery.proxy(this.updateState, this), 2000);
      }
    });
  },
  handleContextMenu: function (event) {
    if (!this.shouldHandleEvent(event)) { return true; }
    if (
      (event.target == document) || //Chrome/Opera
      (event.clientX === event.clientY && event.clientX === 0) //FF/IE
    ) { return false; } //keyboard event. cancel it.
    return true;
  },
  rpcCall: function (method, params) {
    var callObj = {'method': method};
    if (params) { callObj.params = params; }
    return xbmc.rpc.request(callObj);
  },
  musicLibraryOpen: function (event) {
    this.resetPage();
    $('#musicLibrary').addClass('selected');
    $('.contentContainer').hide();
    var libraryContainer = $('#libraryContainer');
    if (!libraryContainer || libraryContainer.length === 0) {
      $('#spinner').show();
      libraryContainer = $('<div>');
      libraryContainer.attr('id', 'libraryContainer')
        .addClass('contentContainer');
      $('#content').append(libraryContainer);
      xbmc.rpc.request({
        'context': this,
        'method': 'AudioLibrary.GetAlbums',
        'params': {
          'limits': {
            'start': 0
          },
          'properties': [
            'description',
            'theme',
            'mood',
            'style',
            'type',
            'albumlabel',
            'artist',
            'genre',
            'rating',
            'title',
            'year',
            'thumbnail'
          ],
          'sort': {
            'method': 'artist'
          }
        },
        'success': function (data) {
          if (data && data.result && data.result.albums) {
            this.albumList = data.result.albums;
            $.each($(this.albumList), jQuery.proxy(function (i, item) {
              var floatableAlbum = this.generateThumb('album', item.thumbnail, item.title, item.artist);
              libraryContainer.append(floatableAlbum);
            }, this));
            libraryContainer.append($('<div>').addClass('footerPadding'));
            $('#spinner').hide();
            libraryContainer.bind('scroll', { activeLibrary: libraryContainer }, jQuery.proxy(this.updateScrollEffects, this));
            libraryContainer.trigger('scroll');
            myScroll = new iScroll('libraryContainer');
          } else {
            libraryContainer.html('');
          }
        }
      });
    } else {
      libraryContainer.show();
      libraryContainer.trigger('scroll');
    }
  },
  getThumbnailPath: function (thumbnail) {
    return thumbnail ? ('image/' + encodeURI(thumbnail)) : xbmc.core.DEFAULT_ALBUM_COVER;
  },
  generateThumb: function (type, thumbnail, title, artist) {
    title = title || '';
    artist = artist ||'';

    var showTitle = title, showArtist = artist;
    var floatableAlbum = $('<div>');
    var path = this.getThumbnailPath(thumbnail);
    if (title.length > 21) { showTitle = $.trim(title.substr(0, 18)) + '...'; }
    if (artist.length > 22) { showArtist = $.trim(artist.substr(0, 20)) + '...'; }
    var className = '';
    var code = '';
    switch(type) {
      case 'album':
        className = 'floatableAlbum';
        code = '<p class="album" title="' + title + '">' + showTitle + '</p><p class="artist" title="' + artist + '">' + artist + '</p>';
        break;
      case 'movie':
        className = 'floatableMovieCover';
        code = '<p class="album" title="' + title + '">' + showTitle + '</p>';
        break;
      case 'tvshow':
        className = 'floatableTVShowCover';
        break;
      case 'tvshowseason':
        className = 'floatableTVShowCoverSeason';
        break;
      case 'image':
      case 'directory':
        className = 'floatableAlbum';
        code = '<p class="album" title="' + title + '">' + showTitle + '</p>';
        break;
      case 'profile':
        className = 'floatableProfileThumb';
        code = '<p class="album" title="' + title + '">' + showTitle + '</p>';
        break;
    }
    return floatableAlbum.addClass(className).html('<div class="imgWrapper"><div class="inner"><img src="' + path + '" alt="' + title + '" /></div></div>' + code);
  },
  showAlbumSelectorBlock: function (album) {
    if (album) {
      var prevAlbum = null,
        nextAlbum = null;
      $.each($(this.albumList), jQuery.proxy(function (i, item) {
        if (item.albumid == album.albumid) {
          if (this.albumList.length > 1) {
            prevAlbum = this.albumList[i <= 0 ? this.albumList.length-1 : i-1];
            nextAlbum = this.albumList[i >= this.albumList.length ? 0 : i+1];
          }
          return false; /* .each break */
        }
      }, this));
      var albumSelectorBlock = $('#albumSelector');
      if (!albumSelectorBlock || albumSelectorBlock.length === 0) {
        albumSelectorBlock = $('<div>');
        albumSelectorBlock.attr('id', 'albumSelector')
          .html('<table><tr><td class="allAlbums">All Albums</td><td class="activeAlbumTitle"></td><td class="prevAlbum">&nbsp;</td><td class="nextAlbum">&nbsp;</td></tr></table>');
        $('#content').prepend(albumSelectorBlock);
        $('#albumSelector .allAlbums').bind('click', jQuery.proxy(this.hideAlbumDetails, this));
      }
      $('#albumSelector .prevAlbum').unbind();
      $('#albumSelector .nextAlbum').unbind();
      if (prevAlbum) {
        $('#albumSelector .prevAlbum').bind('click', {album: prevAlbum}, jQuery.proxy(this.displayAlbumDetails, this));
      }
      if (nextAlbum) {
        $('#albumSelector .nextAlbum').bind('click', {album: nextAlbum}, jQuery.proxy(this.displayAlbumDetails, this));
      }
      $('#albumSelector .activeAlbumTitle').html(album.title||'Unknown Album');
      albumSelectorBlock.show();
    }
  },
  hideAlbumDetails: function () {
    $('.contentContainer').hide();
    this.musicLibraryOpen();
  },
  displayAlbumDetails: function (event) {
    this.showAlbumSelectorBlock(event.data.album);
    var albumDetailsContainer = $('#albumDetails' + event.data.album.albumid);
    $('#topScrollFade').hide();
    if (!albumDetailsContainer || albumDetailsContainer.length === 0) {
      $('#spinner').show();
      xbmc.rpc.request({
        'context': this,
        'method': 'AudioLibrary.GetSongs',
        'params': {
          'properties': [
            'title',
            'artist',
            'genre',
            'track',
            'duration',
            'year',
            'rating',
            'playcount'
          ],
          'sort': {
            'method': 'track'
          },
          'filter': {
            'albumid' : event.data.album.albumid
          }
        },
        'success': function (data) {
          albumDetailsContainer = $('<div>');
          albumDetailsContainer.attr('id', 'albumDetails' + event.data.album.albumid)
            .addClass('contentContainer')
            .addClass('albumContainer')
            .html('<table class="albumView"><thead><tr class="headerRow"><th>Artwork</th><th>&nbsp;</th><th>Name</th><th class="time">Time</th><th>Artist</th><th>Genre</th></tr></thead><tbody class="resultSet"></tbody></table>');
          $('.contentContainer').hide();
          $('#content').append(albumDetailsContainer);
          var albumThumbnail = event.data.album.thumbnail;
          var albumTitle = event.data.album.title||'Unknown Album';
          var albumArtist = event.data.album.artist.join(', ') || 'Unknown Artist';
          var trackCount = data.result.limits.total;
          $.each($(data.result.songs), jQuery.proxy(function (i, item) {
            var trackRow, trackNumberTD;
            if (i === 0) {
              trackRow = $('<tr>').addClass('trackRow').addClass('tr' + i % 2);
              trackRow.append($('<td>').attr('rowspan', ++trackCount + 1).addClass('albumThumb'));
              for (var a = 0; a < 5; a++) {
                trackRow.append($('<td>').html('&nbsp').attr('style', 'display: none'));
              }
              $('#albumDetails' + event.data.album.albumid + ' .resultSet').append(trackRow);
            }
            trackNumberTD = $('<td>').html(item.track);

            trackRow.append(trackNumberTD);
            var trackTitleTD = $('<td>').html(item.title);

            trackRow.append(trackTitleTD);
            var trackDurationTD = $('<td>')
              .addClass('time')
              .html(xbmc.core.durationToString(item.duration));

            trackRow.append(trackDurationTD);
            var trackArtistTD = $('<td>').html(item.artist.join(', '));

            trackRow.append(trackArtistTD);
            var trackGenreTD = $('<td>').html(item.genre.join(', '));

            trackRow.append(trackGenreTD);
            $('#albumDetails' + event.data.album.albumid + ' .resultSet').append(trackRow);
          }, this));
          if (trackCount > 0) {
            var trackRow = $('<tr>').addClass('fillerTrackRow'), i;
            for (i = 0; i < 5; i++) {
              trackRow.append($('<td>').html('&nbsp'));
            }
            $('#albumDetails' + event.data.album.albumid + ' .resultSet').append(trackRow);

            var trackRow2 = $('<tr>').addClass('fillerTrackRow2');
            trackRow2.append($('<td>').addClass('albumBG').html('&nbsp'));
            for (i = 0; i < 5; i++) {
              trackRow2.append($('<td>').html('&nbsp'));
            }
            $('#albumDetails' + event.data.album.albumid + ' .resultSet').append(trackRow2);
          }
          $('#albumDetails' + event.data.album.albumid + ' .albumThumb')
            .append(this.generateThumb('album', albumThumbnail, albumTitle, albumArtist))
            .append($('<div>').addClass('footerPadding'));
          $('#spinner').hide();
          myScroll = new iScroll('albumDetails' + event.data.album.albumid);
        }
      });
    } else {
      $('.contentContainer').hide();
      $('#albumDetails' + event.data.album.albumid).show();
    }
  },
  togglePosterView: function (event) {
    var view=event.data.mode;
    var wthumblist,hthumblist,hthumbdetails;
    $("#toggleBanner").removeClass('activeMode');
    $("#togglePoster").removeClass('activeMode');
    $("#toggleLandscape").removeClass('activeMode');
    switch(view) {
      case 'poster':
        xbmc.core.setCookie('TVView','poster');
        wthumblist='135px';
        hthumblist='199px';
        hthumbdetails='559px';
        $("#togglePoster").addClass('activeMode');
        break;
      case 'landscape':
        xbmc.core.setCookie('TVView','landscape');
        wthumblist='210px';
        hthumblist='118px';
        hthumbdetails='213px';
        $("#toggleLandscape").addClass('activeMode');
        break;
      default:
        xbmc.core.setCookie('TVView','poster');
        wthumblist='135px';
        hthumblist='199px';
        hthumbdetails='559px';
        $("#togglePoster").addClass('activeMode');
        break;
    }
    $(".floatableTVShowCover, .floatableTVShowCover div.imgWrapper, .floatableTVShowCover img, .floatableTVShowCover div.imgWrapper div.inner").css('width',wthumblist).css('height',hthumblist);
    $(".floatableTVShowCoverSeason div.imgWrapper, .floatableTVShowCoverSeason div.imgWrapper div.inner,.floatableTVShowCoverSeason img, .floatableTVShowCoverSeason").css('height',hthumbdetails);
  },
  displayTVShowDetails: function (event) {
    var tvshowDetailsContainer = $('#tvShowDetails' + event.data.tvshow.tvshowid);
    $('#topScrollFade').hide();
    toggle=this.toggle.detach();
    if (!tvshowDetailsContainer || tvshowDetailsContainer.length === 0) {
      $('#spinner').show();
      xbmc.rpc.request({
        'context': this,
        'method': 'VideoLibrary.GetSeasons',
        'params': {
          'properties': [
            'season',
            'showtitle',
            'playcount',
            'episode',
            'thumbnail',
            'fanart'
          ],
          'tvshowid' : event.data.tvshow.tvshowid
        },
        'success': function (data) {
          tvshowDetailsContainer = $('<div>');
          tvshowDetailsContainer.attr('id', 'tvShowDetails' + event.data.tvshow.tvshowid)
            .css('display', 'none')
            .addClass('contentContainer')
            .addClass('tvshowContainer');
          var showThumb = this.generateThumb('tvshowseason', event.data.tvshow.thumbnail, event.data.tvshow.title);
          if (data && data.result && data.result.seasons && data.result.seasons.length > 0) {
            var showDetails = $('<div>').addClass('showDetails');
            showDetails.append(toggle);
            showDetails.append($('<p>').html(data.result.seasons[0].showtitle).addClass('showTitle'));
            var seasonSelectionSelect = $('<select>').addClass('seasonPicker');
            this.tvActiveShowContainer = tvshowDetailsContainer;
            $.each($(data.result.seasons), function (i, item) {
              var season = $('<option>').attr('value',i);
              season.text(item.label);
              seasonSelectionSelect.append(season);
            });
            seasonSelectionSelect.bind('change', {tvshow: event.data.tvshow.tvshowid, seasons: data.result.seasons, element: seasonSelectionSelect}, jQuery.proxy(this.displaySeasonListings, this));
            showDetails.append(seasonSelectionSelect);
            tvshowDetailsContainer.append(showDetails);
            tvshowDetailsContainer.append(showThumb);
            seasonSelectionSelect.trigger('change');
            $('#content').append(tvshowDetailsContainer);
            if (xbmc.core.getCookie('TVView') !== null &&
                xbmc.core.getCookie('TVView') !== 'banner'
            ) {
            var view=xbmc.core.getCookie('TVView');
            switch(view) {
              case 'poster':
                togglePoster.trigger('click');
                break;
              case 'landscape':
                toggleLandscape.trigger('click');
                break;
            }
          }
            tvshowDetailsContainer.fadeIn();
          }
          $('#spinner').hide();
        }
      });
    } else {
      $('.contentContainer').hide();
      $('#tvShowDetails' + event.data.tvshow.tvshowid).show();
      $('#tvShowDetails' + event.data.tvshow.tvshowid +' select').trigger('change');
    }
  },
  displaySeasonListings: function (event) {
    var selectedVal=event.data.element.val();
    var seasons=event.data.seasons;
    $('#topScrollFade').hide();
    var oldListings = $('.episodeListingsContainer', this.tvActiveShowContainer).fadeOut();
    this.tvActiveSeason = selectedVal;
    xbmc.rpc.request({
      'context': this,
      'method': 'VideoLibrary.GetEpisodes',
      'params': {
        'properties': [
          'title',
          'thumbnail',
          'episode',
          'plot',
          'season'
        ],
        'season': seasons[selectedVal].season,
        'tvshowid': event.data.tvshow
      },
      'success': function (data) {
        var episodeListingsContainer = $('<div>').addClass('episodeListingsContainer');
        var episodeTable= $('<table>').addClass('seasonView').html('<thead><tr class="headerRow"><th class="thumbHeader">N&deg;</th><th>Title</th><th class="thumbHeader">Thumb</th><th class="thumbHeader">Details</th></tr></thead><tbody class="resultSet"></tbody>');
        $.each($(data.result.episodes), jQuery.proxy(function (i, item) {
          var episodeRow = $('<tr>').addClass('episodeRow').addClass('tr' + i % 2);
          episodePictureImg.attr('src', this.getThumbnailPath(item.thumbnail));
          var episodeDetails = $('<td class="info">').html('').bind('click',{episode:item}, jQuery.proxy(this.displayEpisodeDetails, this)).css('cursor','pointer');
          episodeRow.append(episodeNumber).append(episodeTitle).append(episodePicture).append(episodeDetails);
          episodeTable.append(episodeRow);
        }, this));
        episodeListingsContainer.append(episodeTable);
        $(this.tvActiveShowContainer).append(episodeListingsContainer);
      }
    });
  },
  displayEpisodeDetails: function (event) {
    var episodeDetails = $('<div>').attr('id', 'episode-' + event.data.episode.episodeid).addClass('episodePopoverContainer');
    episodeDetails.append($('<img>').attr('src', 'images/close-button.png').addClass('closeButton').bind('click', jQuery.proxy(this.hideOverlay, this)));
    episodeDetails.append($('<img>').attr('src', this.getThumbnailPath(event.data.episode.thumbnail)).addClass('episodeCover'));
    var episodeTitle = $('<p>').addClass('episodeTitle');
    var yearText = event.data.episode.year ? ' <span class="year">(' + event.data.episode.year + ')</span>' : '';
    episodeTitle.html(event.data.episode.title + yearText);
    episodeDetails.append(episodeTitle);
    if (event.data.episode.runtime) {
      episodeDetails.append($('<p>').addClass('runtime').html('<strong>Runtime:</strong> ' + Math.ceil(event.data.episode.runtime / 60) + ' minutes'));
    }
    if (event.data.episode.season) {
      episodeDetails.append($('<p>').addClass('season').html('<strong>Season:</strong> ' + event.data.episode.season));
    }
    if (event.data.episode.episode) {
      episodeDetails.append($('<p>').addClass('episode').html('<strong>Episode:</strong> ' + event.data.episode.episode));
    }
    if (event.data.episode.plot) {
      episodeDetails.append($('<p>').addClass('plot').html('<strong>Plot:</strong> <br/><br/>' +event.data.episode.plot));
    }
    if (event.data.episode.genre) {
      episodeDetails.append($('<p>').addClass('genre').html('<strong>Genre:</strong> ' + event.data.episode.genre));
    }
    if (event.data.episode.director) {
      episodeDetails.append($('<p>').addClass('director').html('<strong>Directed By:</strong> ' + event.data.episode.director));
    }
    this.activeCover = episodeDetails;
    $('body').append(episodeDetails);
    $('#overlay').show();
    this.updatePlayButtonLocation();
  },
  hideOverlay: function (event) {
    if (this.activeCover) {
      $(this.activeCover).remove();
      this.activeCover = null;
    }
    $('#overlay').hide();
  },
  updatePlayButtonLocation: function (event) {
    var movieContainer = $('.movieCover'), playIcon;
    if (movieContainer.length > 0) {
      playIcon = $('.playIcon');
      if (playIcon.length > 0) {
        var heightpi=$(movieContainer[0]).height();
        playIcon.width(Math.floor(0.65*heightpi));
        playIcon.height(heightpi);
      }
    }
    var episodeContainer = $('.episodeCover');
    if (episodeContainer.length > 0) {
      playIcon = $('.playIcon');
      if (playIcon.length > 0) {
        var widthpi=$(episodeContainer[0]).width();
        playIcon.width(widthpi);
        //assume 16/9 thumb
        playIcon.height(Math.floor(widthpi*9/16));
      }
    }
  },
  displayMovieDetails: function (event) {
    var movieDetails = $('<div>').attr('id', 'movie-' + event.data.movie.movieid).addClass('moviePopoverContainer');
    movieDetails.append($('<img>').attr('src', 'images/close-button.png').addClass('closeButton').bind('click', jQuery.proxy(this.hideOverlay, this)));
    movieDetails.append($('<img>').attr('src', this.getThumbnailPath(event.data.movie.thumbnail)).addClass('movieCover'));
    var movieTitle = $('<p>').addClass('movieTitle');
    var yearText = event.data.movie.year ? ' <span class="year">(' + event.data.movie.year + ')</span>' : '';
    movieTitle.html(event.data.movie.title + yearText);
    movieDetails.append(movieTitle);
    if (event.data.movie.runtime) {
      movieDetails.append($('<p>').addClass('runtime').html('<strong>Runtime:</strong> ' + Math.ceil(event.data.movie.runtime / 60) + ' minutes'));
    }
    if (event.data.movie.plot) {
      movieDetails.append($('<p>').addClass('plot').html(event.data.movie.plot));
    }
    if (event.data.movie.genre) {
      movieDetails.append($('<p>').addClass('genre').html('<strong>Genre:</strong> ' + event.data.movie.genre));
    }
    if (event.data.movie.director) {
      movieDetails.append($('<p>').addClass('director').html('<strong>Directed By:</strong> ' + event.data.movie.director));
    }
    this.activeCover = movieDetails;
    $('body').append(movieDetails);
    $('#overlay').show();
    this.updatePlayButtonLocation();
  },
  movieLibraryOpen: function () {
    this.resetPage();
    $('#movieLibrary').addClass('selected');
    $('.contentContainer').hide();
    var libraryContainer = $('#movieLibraryContainer');
    if (!libraryContainer || libraryContainer.length === 0) {
      $('#spinner').show();
      xbmc.rpc.request({
        'context': this,
        'method': 'VideoLibrary.GetMovies',
        'params': {
          'limits': {
            'start': 0
          },
          'properties': [
            'genre',
            'director',
            'trailer',
            'tagline',
            'plot',
            'plotoutline',
            'title',
            'originaltitle',
            'lastplayed',
            'runtime',
            'year',
            'playcount',
            'rating',
            'thumbnail',
            'file'
          ],
          'sort': {
            'method': 'sorttitle',
            'ignorearticle': true
          }
        },
        'success': function (data) {
          if (data && data.result && data.result.movies) {
              libraryContainer = $('<div>');
              libraryContainer.attr('id', 'movieLibraryContainer')
                      .addClass('contentContainer');
              $('#content').append(libraryContainer);
          } else {
            libraryContainer.html('');
          }
          $.each($(data.result.movies), jQuery.proxy(function (i, item) {
            var floatableMovieCover = this.generateThumb('movie', item.thumbnail, item.title);
            floatableMovieCover.bind('click', { movie: item }, jQuery.proxy(this.displayMovieDetails, this));
            libraryContainer.append(floatableMovieCover);
          }, this));
          libraryContainer.append($('<div>').addClass('footerPadding'));
          $('#spinner').hide();
          libraryContainer.bind('scroll', { activeLibrary: libraryContainer }, jQuery.proxy(this.updateScrollEffects, this));
          libraryContainer.trigger('scroll');
          myScroll = new iScroll('movieLibraryContainer');
        }
      });
    } else {
      libraryContainer.show();
      libraryContainer.trigger('scroll');
    }
  },
  tvshowLibraryOpen: function () {
    this.resetPage();
    $('#tvshowLibrary').addClass('selected');
    $('.contentContainer').hide();
    var libraryContainer = $('#tvshowLibraryContainer');
    if (!libraryContainer || libraryContainer.length === 0) {
      $('#spinner').show();
      toggle=$('<p>').addClass('toggle');
      togglePoster= $('<span>Poster</span>');
      togglePoster.attr('id', 'togglePoster')
        .css('cursor','pointer')
        .bind('click',{mode: 'poster'},jQuery.proxy(this.togglePosterView,this));
      toggleBanner= $('<span>Banner</span>');
      toggleBanner.attr('id', 'toggleBanner')
        .css('cursor','pointer')
        .addClass('activeMode')
        .bind('click',{mode: 'banner'},jQuery.proxy(this.togglePosterView,this));
      toggleLandscape= $('<span>Landscape</span>');
      toggleLandscape.attr('id', 'toggleLandscape')
        .css('cursor','pointer')
        .bind('click',{mode: 'landscape'},jQuery.proxy(this.togglePosterView,this));
      toggle.append(toggleBanner).append(' | ').append(togglePoster).append(' | ').append(toggleLandscape);
      this.toggle=toggle;
      xbmc.rpc.request({
        'context': this,
        'method': 'VideoLibrary.GetTVShows',
        'params': {
          'properties': [
            'genre',
            'plot',
            'title',
            'lastplayed',
            'episode',
            'year',
            'playcount',
            'rating',
            'thumbnail',
            'studio',
            'mpaa',
            'premiered'
          ]
        },
        'success': function (data) {
          if (data && data.result && data.result.tvshows) {
            libraryContainer = $('<div>');
            libraryContainer.append(toggle);
            libraryContainer.attr('id', 'tvshowLibraryContainer')
              .addClass('contentContainer');
            $('#content').append(libraryContainer);
          } else {
            libraryContainer.html('');
          }
          $.each($(data.result.tvshows), jQuery.proxy(function (i, item) {
            var floatableTVShowCover = this.generateThumb('tvshow', item.thumbnail, item.title);
            floatableTVShowCover.bind('click', { tvshow: item }, jQuery.proxy(this.displayTVShowDetails, this));
            libraryContainer.append(floatableTVShowCover);
          }, this));
          libraryContainer.append($('<div>').addClass('footerPadding'));
          $('#spinner').hide();
          libraryContainer.bind('scroll', { activeLibrary: libraryContainer }, jQuery.proxy(this.updateScrollEffects, this));
          libraryContainer.trigger('scroll');
          myScroll = new iScroll('tvshowLibraryContainer');
          if (xbmc.core.getCookie('TVView') !== null &&
              xbmc.core.getCookie('TVView') !== 'banner'
          ) {
            var view=xbmc.core.getCookie('TVView');
            switch(view) {
              case 'poster':
                togglePoster.trigger('click');
                break;
              case 'landscape':
                toggleLandscape.trigger('click');
                break;
            }
          }
        }
      });
    } else {
      libraryContainer.prepend($(".toggle").detach()).show();
      libraryContainer.trigger('scroll');
    }
  },
  updateScrollEffects: function (event) {
    if (event.data.activeLibrary && $(event.data.activeLibrary).scrollTop() > 0) {
      $('#topScrollFade').fadeIn();
    } else {
      $('#topScrollFade').fadeOut();
    }
  },
  startSlideshow: function (event) {
    xbmc.rpc.request({
      'method': 'Player.Open',
      'params': {
        'item': {
          'recursive': 'true',
          'random': 'true',
          'path' : this.replaceAll(event.data.directory.file, "\\", "\\\\")
        }
      },
      'success': function () {}
    });
  },
  showDirectory: function (event) {
    var directory = event.data.directory.file;
    var jsonDirectory = this.replaceAll(directory, "\\", "\\\\");
    this.resetPage();
    $('#pictureLibrary').addClass('selected');
    $('.contentContainer').hide();
    var libraryContainer = $('#pictureLibraryDirContainer' + directory);
    if (!libraryContainer || libraryContainer.length === 0) {
      $('#spinner').show();
      xbmc.rpc.request({
        'context': this,
        'method': 'Files.GetDirectory',
        'params': {
          'media' : 'pictures',
          'directory': jsonDirectory
        },
        'success': function (data) {
          if (data && data.result && ( data.result.directories || data.result.files )) {
            libraryContainer = $('<div>');
            libraryContainer.attr('id', 'pictureLibraryDirContainer' + directory)
              .addClass('contentContainer');
            $('#content').append(libraryContainer);
            var breadcrumb = $('<div>');
            var seperator = '/';
            var item = '';
            var directoryArray = directory.split(seperator);
            jQuery.each(directoryArray, function (i,v) {
              if (v !== '') {
                item += v + seperator;
                breadcrumb.append($('<div>').text(' > ' + v).css('float','left').addClass('breadcrumb'));
              }
            });
            libraryContainer.append(breadcrumb);
            libraryContainer.append($('<div>').css('clear','both'));
            if (data.result.files) {
              $.each($(data.result.files), jQuery.proxy(function (i, item) {
                if (item.filetype == "file")
                {
                  var floatableImage = this.generateThumb('image', item.file, item.label);
                  libraryContainer.append(floatableImage);
                }
                else if (item.filetype == "directory")
                {
                  var floatableShare = this.generateThumb('directory', item.thumbnail, item.label);
                  floatableShare.bind('click', { directory: item }, jQuery.proxy(this.showDirectory, this));
                  libraryContainer.append(floatableShare);
                }
              }, this));
            }
            libraryContainer.append($('<div>').addClass('footerPadding'));
          } else {
            libraryContainer.html('');
          }
          $('#spinner').hide();
          libraryContainer.bind('scroll', { activeLibrary: libraryContainer }, jQuery.proxy(this.updateScrollEffects, this));
          libraryContainer.trigger('scroll');
          myScroll = new iScroll('#pictureLibraryDirContainer' + directory);
        }
      });
    } else {
      libraryContainer.show();
      libraryContainer.trigger('scroll');
    }
  },
  pictureLibraryOpen: function () {
    this.resetPage();
    $('#pictureLibrary').addClass('selected');
    $('.contentContainer').hide();
    var libraryContainer = $('#pictureLibraryContainer');
    if (!libraryContainer || libraryContainer.length === 0) {
      $('#spinner').show();
      xbmc.rpc.request({
        'context': this,
        'method': 'Files.GetSources',
        'params': {
          'media' : 'pictures'
        },
        'success': function (data) {
          if (data && data.result && data.result.shares) {
            libraryContainer = $('<div>');
            libraryContainer.attr('id', 'pictureLibraryContainer')
              .addClass('contentContainer');
            $('#content').append(libraryContainer);
          } else {
            libraryContainer.html('');
          }
          $.each($(data.result.shares), jQuery.proxy(function (i, item) {
            var floatableShare = this.generateThumb('directory', item.thumbnail, item.label);
            libraryContainer.append(floatableShare);
          }, this));
          libraryContainer.append($('<div>').addClass('footerPadding'));
          $('#spinner').hide();
          libraryContainer.bind('scroll', { activeLibrary: libraryContainer }, jQuery.proxy(this.updateScrollEffects, this));
          libraryContainer.trigger('scroll');
          myScroll = new iScroll('#pictureLibraryContainer');
        }
      });
    } else {
      libraryContainer.show();
      libraryContainer.trigger('scroll');
    }
  }
};