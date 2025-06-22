const API_KEY = 'AIzaSyDII2d6DP-DUPAMetrEFNxZifRxESIF2QI';
document.getElementById('channel-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const input = document.getElementById('channel-input').value.trim();

  // Show info box with loading message
  const channelInfoDiv = document.getElementById('channel-info');
  const topVideosDiv = document.getElementById('top-videos');
  channelInfoDiv.innerHTML = 'Loading...';
  topVideosDiv.innerHTML = '';
  channelInfoDiv.style.display = 'block';
  topVideosDiv.style.display = 'none';
  document.getElementById('stats-chart').style.display = 'none';

  let channelId = input;
  // If user entered a username, resolve to channelId
  if (!input.startsWith('UC')) {
    channelId = await getChannelIdFromUsername(input);
    if (!channelId) {
      channelInfoDiv.innerHTML = 'Channel not found.';
      channelInfoDiv.style.display = 'block';
      topVideosDiv.style.display = 'none';
      return;
    }
  }

  const channelData = await getChannelInfo(channelId);
  if (!channelData) {
    channelInfoDiv.innerHTML = 'Channel not found.';
    channelInfoDiv.style.display = 'block';
    topVideosDiv.style.display = 'none';
    return;
  }
  showChannelInfo(channelData);

  const statsData = await getChannelStatsOverTime(channelId);
  showChart(statsData);

  const videos = await getTopVideos(channelId);
  showTopVideos(videos);
});

async function getChannelIdFromUsername(username) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  // Corrected: check for items and return first item's id
  return data.items && data.items[0] ? data.items[0].id : null;
}

async function getChannelInfo(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  // Corrected: check for items and return first item
  return data.items && data.items[0] ? data.items[0] : null;
}

function showChannelInfo(channel) {
  const infoDiv = document.getElementById('channel-info');
  const { title, description, thumbnails } = channel.snippet;
  const { subscriberCount, viewCount, videoCount } = channel.statistics;
  infoDiv.innerHTML = `
    <div class="channel-header">
      <img src="${thumbnails.default.url}" alt="Channel Thumbnail">
      <div>
        <h2>${title}</h2>
        <p>${description}</p>
        <p><b>Subscribers:</b> ${Number(subscriberCount).toLocaleString()}</p>
        <p><b>Total Views:</b> ${Number(viewCount).toLocaleString()}</p>
        <p><b>Total Videos:</b> ${Number(videoCount).toLocaleString()}</p>
      </div>
    </div>
  `;
  infoDiv.style.display = 'block';
}

async function getTopVideos(channelId) {
  // Get uploads playlist ID
  const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`);
  const playlistData = await playlistRes.json();
  if (!playlistData.items || !playlistData.items[0]) return [];
  const uploadsId = playlistData.items[0].contentDetails.relatedPlaylists.uploads;

  // Get latest 50 videos (API limit)
  const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${API_KEY}`);
  const videosData = await videosRes.json();
  if (!videosData.items || videosData.items.length === 0) return [];

  // Extract video IDs
  const videoIds = videosData.items.map(item => item.snippet.resourceId.videoId).join(',');
  // Get video statistics
  const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${API_KEY}`);
  const statsData = await statsRes.json();
  if (!statsData.items || statsData.items.length === 0) return [];

  // Sort videos by view count
  const sorted = statsData.items.sort((a, b) => b.statistics.viewCount - a.statistics.viewCount);
  return sorted.slice(0, 5);
}

function showTopVideos(videos) {
  const div = document.getElementById('top-videos');
  if (!videos || videos.length === 0) {
    div.innerHTML = '<p>No videos found.</p>';
    div.style.display = 'block';
    return;
  }
  div.innerHTML = '<h3>Top 5 Most Viewed Videos</h3>';
  videos.forEach(video => {
    div.innerHTML += `
      <div class="video-card">
        <img src="${video.snippet.thumbnails.medium.url}" alt="Thumbnail">
        <div>
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.snippet.title}</a>
          <p>Views: ${Number(video.statistics.viewCount).toLocaleString()}</p>
        </div>
      </div>
    `;
  });
  div.style.display = 'block';
}

// For demo: Simulate stats over time (YouTube API does not provide historical data directly)
async function getChannelStatsOverTime(channelId) {
  const channel = await getChannelInfo(channelId);
  if (!channel) return { months: [], subs: [], views: [] };
  const now = new Date();
  const months = [];
  const subs = [];
  const views = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));
    // Simulate with random growth
    subs.push(Math.floor(channel.statistics.subscriberCount * (1 - i * 0.1)));
    views.push(Math.floor(channel.statistics.viewCount * (1 - i * 0.1)));
  }
  return { months, subs, views };
}

function showChart(data) {
  document.getElementById('stats-chart').style.display = 'block';
  const ctx = document.getElementById('stats-chart').getContext('2d');
  if (window.statsChart) window.statsChart.destroy();
  window.statsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.months,
      datasets: [
        {
          label: 'Subscribers',
          data: data.subs,
          borderColor: 'blue',
          backgroundColor: 'rgba(0,0,255,0.1)',
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Views',
          data: data.views,
          borderColor: 'green',
          backgroundColor: 'rgba(0,255,0,0.1)',
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Subscribers' } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Views' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}
