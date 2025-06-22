const API_KEY = 'AIzaSyDII2d6DP-DUPAMetrEFNxZifRxESIF2QI';
let windowCurrentVideos = []; // Export/analytics 

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

  const videos = await getAllVideos(channelId);
  windowCurrentVideos = videos; // For CSV export

  // Analytics
  showAverageViews(videos);
  showUploadFrequency(videos);
  renderViewsLineChart(videos);
  renderCategoryPieChart(videos);

  showTopVideos(videos.slice(0, 5)); // Top 5 by views
});

async function getChannelIdFromUsername(username) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items && data.items[0] ? data.items[0].id : null;
}

async function getChannelInfo(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items && data.items[0] ? data.items[0] : null;
}

// Fetch up to 50 latest videos with stats
async function getAllVideos(channelId) {
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
  return sorted;
}

// --- Analytics Functions ---

function calculateAverageViews(videos) {
  if (!videos.length) return 0;
  const totalViews = videos.reduce((sum, video) => sum + Number(video.statistics.viewCount), 0);
  return Math.round(totalViews / videos.length);
}
function showAverageViews(videos) {
  const avgViews = calculateAverageViews(videos);
  document.getElementById('avg-views').textContent = `Average Views per Video: ${avgViews.toLocaleString()}`;
}

function calculateUploadFrequency(videos) {
  if (videos.length < 2) return { perWeek: 0, perMonth: 0 };
  const dates = videos.map(v => new Date(v.snippet.publishedAt)).sort((a, b) => b - a);
  const first = dates[dates.length - 1];
  const last = dates[0];
  const days = (last - first) / (1000 * 60 * 60 * 24) || 1;
  const perWeek = (videos.length / days) * 7;
  const perMonth = (videos.length / days) * 30;
  return {
    perWeek: perWeek.toFixed(2),
    perMonth: perMonth.toFixed(2)
  };
}
function showUploadFrequency(videos) {
  const freq = calculateUploadFrequency(videos);
  document.getElementById('upload-frequency').textContent = `Upload Frequency: ${freq.perWeek} videos/week, ${freq.perMonth} videos/month`;
}

// --- Chart.js Visualizations ---

function renderViewsLineChart(videos) {
  const ctx = document.getElementById('views-line-chart').getContext('2d');
  const labels = videos.map(v => v.snippet.title);
  const data = videos.map(v => Number(v.statistics.viewCount));
  if (window.viewsLineChart) window.viewsLineChart.destroy();
  window.viewsLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Views',
        data,
        borderColor: 'blue',
        backgroundColor: 'rgba(0,0,255,0.1)',
        fill: true,
      }]
    },
    options: { responsive: true }
  });
}

async function fetchCategoryNames() {
  const url = `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const map = {};
  data.items.forEach(item => map[item.id] = item.snippet.title);
  return map;
}
async function renderCategoryPieChart(videos) {
  const categoryCounts = {};
  videos.forEach(v => {
    const cat = v.snippet.categoryId;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const categoryMap = await fetchCategoryNames();
  const labels = Object.keys(categoryCounts).map(id => categoryMap[id] || id);
  const data = Object.values(categoryCounts);

  const ctx = document.getElementById('category-pie-chart').getContext('2d');
  if (window.categoryPieChart) window.categoryPieChart.destroy();
  window.categoryPieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#3e38d6', '#ff4b59', '#1e88e5', '#ffe082', '#23272f'],
      }]
    },
    options: { responsive: true }
  });
}

// --- CSV Export ---

function exportVideosToCSV(videos) {
  if (!videos || !videos.length) return;
  const headers = ['Title', 'Views', 'Likes', 'Comments', 'Published At'];
  const rows = videos.map(v => [
    `"${v.snippet.title.replace(/"/g, '""')}"`,
    v.statistics.viewCount,
    v.statistics.likeCount || '',
    v.statistics.commentCount || '',
    v.snippet.publishedAt
  ]);
  let csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'youtube_video_stats.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
document.getElementById('export-csv-btn').onclick = function() {
  exportVideosToCSV(windowCurrentVideos);
};

// --- Existing functions for info and top videos ---

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
