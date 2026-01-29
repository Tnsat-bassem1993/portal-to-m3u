import { useState } from 'react';
import { Download, Tv, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface FormData {
  portalUrl: string;
  macAddress: string;
}

interface ConversionResult {
  success: boolean;
  m3uContent?: string;
  channelCount?: number;
  movieCount?: number;
  seriesCount?: number;
  totalCount?: number;
  error?: string;
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    portalUrl: '',
    macAddress: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'movies' | 'series' | 'all'>('all');
  const [debugInfo, setDebugInfo] = useState<any>(null);

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
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();
      console.log('Full response:', data);
      setDebugInfo(data);

      if (response.ok && data.success) {
        setResult({
          success: true,
          m3uContent: data.m3uContent,
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

  const handleDownload = () => {
    if (!result?.m3uContent) return;

    const blob = new Blob([result.m3uContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.m3u';
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
                      onClick={handleDownload}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all inline-flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                      <Download className="w-5 h-5" />
                      Download M3U File
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

        {debugInfo && (
          <div className="mt-8 bg-gray-900 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Debug Info</h2>
            <div className="bg-gray-800 rounded-lg p-4 text-gray-100 text-sm font-mono overflow-auto max-h-96">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
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
                Enter your Stalker Portal URL. This is provided by your IPTV
                service provider and typically ends with <code className="bg-gray-100 px-2 py-1 rounded">/c/</code>
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                2
              </span>
              <p>
                Enter your MAC address. This is the unique identifier for your device,
                usually in the format XX:XX:XX:XX:XX:XX
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                3
              </span>
              <p>
                Click "Convert to M3U" and wait for the conversion to complete
              </p>
            </div>
            <div className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                4
              </span>
              <p>
                Download your M3U file and use it with any compatible IPTV player
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
