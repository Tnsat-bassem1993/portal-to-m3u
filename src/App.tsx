import { useState, useEffect } from 'react';
import { Download, Tv, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface FormData {
  portalUrl: string;
  macAddress: string;
}

interface Channel {
  id: string;
  name: string;
  cmd: string;
  logo?: string;
  group: string;
}

interface VODItem {
  id: string;
  name: string;
  cmd: string;
  poster?: string;
  group: string;
}

interface ConversionResult {
  success: boolean;
  sessionId?: string;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number;
  totalCount?: number;
  error?: string;
}

interface StoredData {
  channels: Channel[];
  movies: VODItem[];
  series: VODItem[];
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    portalUrl: '',
    macAddress: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [storedData, setStoredData] = useState<StoredData | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [activeTab, setActiveTab] = useState<'channels' | 'movies' | 'series'>('channels');
  const [showModal, setShowModal] = useState(false);

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stalker-converter`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...formData, sessionId }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({
          success: true,
          sessionId: data.sessionId,
          channelCount: data.channelCount,
          movieCount: data.movieCount,
          seriesCount: data.seriesCount,
          totalCount: data.totalCount,
        });
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to convert playlist',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStoredData = async () => {
    if (!result?.sessionId) return;

    try {
      const { data, error } = await supabase
        .from('conversions')
        .select('channels_data, movies_data, series_data')
        .eq('user_session_id', result.sessionId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStoredData({
          channels: data.channels_data || [],
          movies: data.movies_data || [],
          series: data.series_data || [],
        });
        setShowModal(true);
        setActiveTab('channels');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateM3U = (type: 'channels' | 'movies' | 'series') => {
    if (!storedData) return '';

    let m3u = '#EXTM3U\n';
    const items = type === 'channels' ? storedData.channels : type === 'movies' ? storedData.movies : storedData.series;

    for (const item of items) {
      const tvgLogo = item.logo || item.poster ? ` tvg-logo="${item.logo || item.poster}"` : '';
      const tvgId = item.id ? ` tvg-id="${item.id}"` : '';
      const groupTitle = item.group ? ` group-title="${item.group}"` : '';

      m3u += `#EXTINF:-1${tvgId}${tvgLogo}${groupTitle},${item.name}\n`;
      let streamUrl = item.cmd;
      if (streamUrl && !streamUrl.startsWith('http')) {
        streamUrl = streamUrl.replace(/^(ffmpeg|ffrt|ffrt2k) /, '');
      }
      m3u += `${streamUrl}\n`;
    }

    return m3u;
  };

  const handleDownload = (type: 'channels' | 'movies' | 'series') => {
    const m3uContent = generateM3U(type);
    const blob = new Blob([m3uContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlist_${type}.m3u`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <Tv className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Stalker to M3U Converter
          </h1>
          <p className="text-lg text-gray-600">
            Convert your Stalker Portal playlist to standard M3U format
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="portalUrl"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Portal URL
              </label>
              <input
                type="url"
                id="portalUrl"
                name="portalUrl"
                value={formData.portalUrl}
                onChange={handleInputChange}
                placeholder="http://example.com/stalker_portal/c/"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter your Stalker Portal URL (usually ends with /c/)
              </p>
            </div>

            <div>
              <label
                htmlFor="macAddress"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                MAC Address
              </label>
              <input
                type="text"
                id="macAddress"
                name="macAddress"
                value={formData.macAddress}
                onChange={handleInputChange}
                placeholder="00:1A:79:XX:XX:XX"
                required
                pattern="[0-9A-Fa-f:]{17}"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter your device MAC address (format: XX:XX:XX:XX:XX:XX)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Convert to M3U
                </>
              )}
            </button>
          </form>
        </div>

        {result && (
          <div
            className={`rounded-2xl shadow-xl p-8 ${
              result.success
                ? 'bg-green-50 border-2 border-green-200'
                : 'bg-red-50 border-2 border-red-200'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              )}
              <div className="flex-1">
                {result.success ? (
                  <>
                    <h3 className="text-xl font-bold text-green-900 mb-3">
                      Conversion Successful!
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{result.channelCount}</div>
                        <div className="text-sm text-gray-600">Live Channels</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{result.movieCount}</div>
                        <div className="text-sm text-gray-600">Movies</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{result.seriesCount}</div>
                        <div className="text-sm text-gray-600">Series</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{result.totalCount}</div>
                        <div className="text-sm text-gray-600">Total Items</div>
                      </div>
                    </div>
                    <button
                      onClick={loadStoredData}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all inline-flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <Eye className="w-5 h-5" />
                      View Results
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-red-900 mb-2">
                      Conversion Failed
                    </h3>
                    <p className="text-red-700">{result.error}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showModal && storedData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Results</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="flex border-b border-gray-200">
                {['channels', 'movies', 'series'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-4 font-semibold transition-all ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tab === 'channels' ? `Live Channels (${storedData.channels.length})` : ''}
                    {tab === 'movies' ? `Movies (${storedData.movies.length})` : ''}
                    {tab === 'series' ? `Series (${storedData.series.length})` : ''}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-2">
                  {(activeTab === 'channels' ? storedData.channels : activeTab === 'movies' ? storedData.movies : storedData.series).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                      {(item.logo || item.poster) && (
                        <img
                          src={item.logo || item.poster}
                          alt={item.name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-sm text-gray-600 truncate">{item.group}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => handleDownload(activeTab)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Download {activeTab === 'channels' ? 'Channels' : activeTab === 'movies' ? 'Movies' : 'Series'} M3U
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            How to Use
          </h2>
          <div className="space-y-4 text-gray-600">
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                1
              </span>
              <p>
                Enter your Stalker Portal URL and MAC address
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                2
              </span>
              <p>
                Click "Convert to M3U" and wait for the conversion to complete
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                3
              </span>
              <p>
                Click "View Results" to see all live channels, movies, and series
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                4
              </span>
              <p>
                Download individual M3U files for each category
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
