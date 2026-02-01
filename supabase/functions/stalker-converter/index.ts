import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StalkerRequest {
  portalUrl: string;
  macAddress: string;
  sessionId?: string; // now optional
}

interface Channel {
  id: string;
  name: string;
  cmd: string;
  logo?: string;
  number?: string;
  group: string;
}

interface VODItem {
  id: string;
  name: string;
  cmd: string;
  poster?: string;
  group: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { portalUrl, macAddress, sessionId }: StalkerRequest = await req.json();

    if (!portalUrl || !macAddress) {
      return new Response(JSON.stringify({
        success: false,
        error: "Portal URL and MAC address are required",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If no sessionId provided, generate one automatically
    const effectiveSessionId = sessionId || crypto.randomUUID();

    const cleanUrl = portalUrl.trim().replace(/\/+$/, '');
    const cleanMac = macAddress.toUpperCase().replace(/[:-]/g, '');
    const formattedMac = cleanMac.match(/.{1,2}/g)?.join(':') || macAddress;

    const token = await handshake(cleanUrl, formattedMac);

    const channelsData = await getChannelsRaw(cleanUrl, formattedMac, token);
    const moviesData = await getVODRaw(cleanUrl, formattedMac, token, 'movies');
    const seriesData = await getVODRaw(cleanUrl, formattedMac, token, 'series');

    const channels = parseChannels(channelsData);
    const movies = parseVOD(moviesData, 'movies');
    const series = parseVOD(seriesData, 'series');

    // Store in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('conversions').upsert({
      user_session_id: effectiveSessionId,
      portal_url: portalUrl,
      mac_address: macAddress,
      channels_data: channels,
      movies_data: movies,
      series_data: series,
      channel_count: channels.length,
      movie_count: movies.length,
      series_count: series.length,
    });

    return new Response(JSON.stringify({
      success: true,
      sessionId: effectiveSessionId,
      channelCount: channels.length,
      movieCount: movies.length,
      seriesCount: series.length,
      totalCount: channels.length + movies.length + series.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

      

async function handshake(portalUrl: string, macAddress: string): Promise<string> {
  const url = `${portalUrl}/portal.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
      "X-User-Agent": "Model: MAG250; Link: WiFi",
      "Cookie": `mac=${macAddress.replace(/:/g, '%3A')}; stb_lang=en; timezone=Europe/London`,
    },
  });

  if (!response.ok) throw new Error(`Handshake failed: ${response.statusText}`);
  const data = await response.json();
  if (data.js && data.js.token) return data.js.token;
  throw new Error("Failed to get token from handshake");
}

async function getChannelsRaw(portalUrl: string, macAddress: string, token: string): Promise<any> {
  const url = `${portalUrl}/portal.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
      "X-User-Agent": "Model: MAG250; Link: WiFi",
      "Authorization": `Bearer ${token}`,
      "Cookie": `mac=${macAddress.replace(/:/g, '%3A')}; stb_lang=en; timezone=Europe/London`,
    },
  });

  if (!response.ok) throw new Error(`Failed to get channels: ${response.statusText}`);
  return await response.json();
}

function parseChannels(data: any): Channel[] {
  return data.js?.data?.map((channel: any) => ({
    id: channel.id || '',
    name: channel.name || 'Unknown Channel',
    cmd: channel.cmd || '',
    logo: channel.logo || '',
    number: channel.number || channel.id || '',
    group: 'Live TV',
  })) || [];
}

async function getVODRaw(portalUrl: string, macAddress: string, token: string, type: 'movies' | 'series'): Promise<any> {
  const vodCategories = await getVODCategories(portalUrl, macAddress, token, type);
  const allVOD: VODItem[] = [];
  const rawResponses: any[] = [];

  for (const category of vodCategories) {
    if (type === 'movies') {
      const items = await getVODItems(portalUrl, macAddress, token, category.id, category.name, type);
      allVOD.push(...items);
    } else {
      const episodes = await getSeriesEpisodes(portalUrl, macAddress, token, category.id, category.name);
      allVOD.push(...episodes);
    }
  }

  return {
    categories: vodCategories,
    items: allVOD,
  };
}

function parseVOD(data: any, type: 'movies' | 'series'): VODItem[] {
  return data.items || [];
}

async function getVOD(portalUrl: string, macAddress: string, token: string, type: 'movies' | 'series'): Promise<VODItem[]> {
  const vodCategories = await getVODCategories(portalUrl, macAddress, token, type);
  const allVOD: VODItem[] = [];

  for (const category of vodCategories) {
    if (type === 'movies') {
      const items = await getVODItems(portalUrl, macAddress, token, category.id, category.name, type);
      allVOD.push(...items);
    } else {
      const episodes = await getSeriesEpisodes(portalUrl, macAddress, token, category.id, category.name);
      allVOD.push(...episodes);
    }
  }

  return allVOD;
}

async function getVODCategories(portalUrl: string, macAddress: string, token: string, type: 'movies' | 'series'): Promise<Array<{ id: string; name: string }>> {
  const portalType = type === 'movies' ? 'vod' : 'series';
  const url = `${portalUrl}/portal.php?type=${portalType}&action=get_categories&JsHttpRequest=1-xml`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
      "X-User-Agent": "Model: MAG250; Link: WiFi",
      "Authorization": `Bearer ${token}`,
      "Cookie": `mac=${macAddress.replace(/:/g, '%3A')}; stb_lang=en; timezone=Europe/London`,
    },
  });

  if (!response.ok) return [];
  const data = await response.json();

  return data.js?.data?.map((cat: any) => ({
    id: cat.id || '',
    name: cat.title || cat.name || 'Unknown',
  })) || [];
}

async function getStreamLink(portalUrl: string, macAddress: string, token: string, cmd: string, type: 'movies' | 'series'): Promise<string> {
  const portalType = 'vod'; // both movies and series resolve via vod
  const seriesFlag = type === 'series' ? '&series=1' : '';
  const url = `${portalUrl}/portal.php?type=${portalType}&action=create_link&cmd=${encodeURIComponent(cmd)}${seriesFlag}&JsHttpRequest=1-xml`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
      "X-User-Agent": "Model: MAG250; Link: WiFi",
      "Authorization": `Bearer ${token}`,
      "Cookie": `mac=${macAddress.replace(/:/g, '%3A')}; stb_lang=en; timezone=Europe/London`,
    },
  });

  if (!response.ok) return '';
  const data = await response.json();
  return data.js?.cmd || '';
}
async function getVODItems(
  portalUrl: string,
  macAddress: string,
  token: string,
  categoryId: string,
  categoryName: string,
  type: 'movies' | 'series'
): Promise<VODItem[]> {
  const portalType = type === 'movies' ? 'vod' : 'series';
  const allVOD: VODItem[] = [];
  let page = 1;

  while (true) {
    const url = `${portalUrl}/portal.php?type=${portalType}&action=get_ordered_list&movie_id=${categoryId}:${categoryId}&season_id=0&episode_id=0&category=${categoryId}&fav=0&sortby=added&hd=0&not_ended=0&p=${page}&JsHttpRequest=1-xml`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
        "X-User-Agent": "Model: MAG250; Link: WiFi",
        "Authorization": `Bearer ${token}`,
        "Cookie": `mac=${macAddress.replace(/:/g, '%3A')}; stb_lang=en; timezone=Europe/London`,
      },
    });

    if (!response.ok) break;
    const data = await response.json();
    const items = data.js?.data || [];
    if (items.length === 0) break;

    for (const item of items) {
      if (!item.cmd) continue;

      // Resolve actual stream link
      const streamUrl = await getStreamLink(portalUrl, macAddress, token, item.cmd, type);
      if (!streamUrl) continue;

      allVOD.push({
        id: item.id || '',
        name: item.name || item.title || 'Unknown',
        cmd: streamUrl,
        poster: item.poster_url || item.poster || '',
        group: `${type === 'movies' ? 'Movies' : 'Series'} – ${categoryName}`,
      });
    }

    page++;
  }

  return allVOD;
}

function generateM3U(channels: Channel[], movies: VODItem[], series: VODItem[]): string {
  let m3u = '#EXTM3U\n';

  // Live TV channels
  for (const channel of channels) {
    const tvgLogo = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
    const tvgId = channel.id ? ` tvg-id="${channel.id}"` : '';
    const groupTitle = channel.group ? ` group-title="${channel.group}"` : '';

    m3u += `#EXTINF:-1${tvgId}${tvgLogo}${groupTitle},${channel.name}\n`;

    let streamUrl = channel.cmd;
    if (streamUrl && !streamUrl.startsWith('http')) {
      streamUrl = streamUrl.replace(/^(ffmpeg|ffrt|ffrt2k) /, '');
    }

    m3u += `${streamUrl}\n`;
  }

  // Movies
  for (const movie of movies) {
    const tvgLogo = movie.poster ? ` tvg-logo="${movie.poster}"` : '';
    const tvgId = movie.id ? ` tvg-id="${movie.id}"` : '';
    const groupTitle = movie.group ? ` group-title="${movie.group}"` : '';

    m3u += `#EXTINF:-1${tvgId}${tvgLogo}${groupTitle},${movie.name}\n`;

    let streamUrl = movie.cmd;
    if (streamUrl && !streamUrl.startsWith('http')) {
      streamUrl = streamUrl.replace(/^(ffmpeg|ffrt|ffrt2k) /, '');
    }

    m3u += `${streamUrl}\n`;
  }

  // Series episodes
  for (const serie of series) {
    const tvgLogo = serie.poster ? ` tvg-logo="${serie.poster}"` : '';
    const tvgId = serie.id ? ` tvg-id="${serie.id}"` : '';
    const groupTitle = serie.group ? ` group-title="${serie.group}"` : '';

    m3u += `#EXTINF:-1${tvgId}${tvgLogo}${groupTitle},${serie.name}\n`;

    let streamUrl = serie.cmd;
    if (streamUrl && !streamUrl.startsWith('http')) {
      streamUrl = streamUrl.replace(/^(ffmpeg|ffrt|ffrt2k) /, '');
    }

    m3u += `${streamUrl}\n`;
  }

  return m3u;
}
