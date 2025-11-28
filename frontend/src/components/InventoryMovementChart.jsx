import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

// Lazy-load Recharts only when this component is mounted
const loadRecharts = () =>
  import('recharts').then(module => ({
    LineChart: module.LineChart,
    Line: module.Line,
    XAxis: module.XAxis,
    YAxis: module.YAxis,
    CartesianGrid: module.CartesianGrid,
    Tooltip: module.Tooltip,
    Legend: module.Legend,
    ResponsiveContainer: module.ResponsiveContainer,
  }));

const MOVEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'SALE', label: 'Sales (Stock Out)' },
  { value: 'RESTOCK', label: 'Restock (Stock In)' },
  { value: 'RETURN', label: 'Returns (Stock In)' },
  { value: 'WASTAGE', label: 'Wastage / Spoilage' },
  { value: 'ADJUSTMENT', label: 'Manual Adjustments' },
];

const formatLocalDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const InventoryMovementChart = () => {
  const [chartComponents, setChartComponents] = useState(null);
  const [loadingChartLib, setLoadingChartLib] = useState(true);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
      productId: '',
      type: '',
    };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load chart library once
  useEffect(() => {
    let isMounted = true;
    loadRecharts()
      .then(components => {
        if (isMounted) {
          setChartComponents(components);
          setLoadingChartLib(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadingChartLib(false);
          toast.error('Failed to load chart library');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load products for dropdown
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get('/products?isActive=true');
        setProducts(res.data.data || []);
      } catch (error) {
        console.error('Error fetching products for movement report:', error);
        toast.error('Failed to load products for inventory movement filters');
      }
    };
    fetchProducts();
  }, []);

  const fetchMovement = async () => {
    if (!filters.start || !filters.end) {
      toast.error('Please select a valid date range');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start', filters.start);
      params.append('end', filters.end);
      if (filters.productId) params.append('productId', filters.productId);
      if (filters.type) params.append('type', filters.type);

      const res = await axios.get(`/reports/inventory-movement?${params.toString()}`);
      setData(res.data || null);
    } catch (error) {
      console.error('Error fetching inventory movement:', error);
      toast.error('Failed to load inventory movement report');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on first mount
  useEffect(() => {
    fetchMovement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const renderChart = () => {
    if (loadingChartLib) {
      return (
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
        </div>
      );
    }

    if (!chartComponents || !data?.dailyNetMovement || data.dailyNetMovement.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <p>No movement data for the selected filters.</p>
        </div>
      );
    }

    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = chartComponents;

    // Optional running stock level line: approximate by cumulative sum of netMovement
    let runningTotal = 0;
    const chartData = data.dailyNetMovement.map(item => {
      runningTotal += item.netMovement || 0;
      return {
        ...item,
        runningStock: runningTotal,
      };
    });

    return (
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="netMovement" stroke="#2563eb" name="Net Movement" />
            <Line type="monotone" dataKey="runningStock" stroke="#16a34a" name="Running Stock (approx.)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const totalIn = data?.summary?.totalStockIn || 0;
  const totalOut = data?.summary?.totalStockOut || 0;
  const net = data?.summary?.netMovement || 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Inventory Movement</h2>
          <p className="text-sm text-gray-600">
            Track stock in/out over time with filters by product and movement type.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start}
              onChange={e => handleFilterChange('start', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end}
              onChange={e => handleFilterChange('end', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
            <select
              value={filters.productId}
              onChange={e => handleFilterChange('productId', e.target.value)}
              className="border rounded px-2 py-1 text-sm min-w-[180px]"
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Movement Type</label>
            <select
              value={filters.type}
              onChange={e => handleFilterChange('type', e.target.value)}
              className="border rounded px-2 py-1 text-sm min-w-[160px]"
            >
              {MOVEMENT_TYPES.map(mt => (
                <option key={mt.value || 'all'} value={mt.value}>
                  {mt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchMovement}
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-700 mb-1">Total Stock In</div>
          <div className="text-2xl font-bold text-blue-900">{totalIn}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <div className="text-xs font-medium text-red-700 mb-1">Total Stock Out</div>
          <div className="text-2xl font-bold text-red-900">{totalOut}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
          <div className="text-xs font-medium text-emerald-700 mb-1">Net Movement</div>
          <div className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-900' : 'text-red-700'}`}>
            {net}
          </div>
        </div>
      </div>

      {/* Chart */}
      {renderChart()}

      {/* Product summary table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Movement by Product</h3>
        {data?.byProduct && data.byProduct.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Beginning Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Stock In</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Stock Out</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Ending Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.byProduct.map(row => (
                  <tr key={row.productId} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{row.productName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.productCategory || '—'}</td>
                    <td className="px-3 py-2 text-right">{row.beginningQuantity ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{row.totalStockIn ?? 0}</td>
                    <td className="px-3 py-2 text-right">{Math.abs(row.totalStockOut ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{row.endingQuantity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No per-product summary for the selected filters.</p>
        )}
      </div>

      {/* Raw movement table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Movement Entries</h3>
        {data?.entries && data.entries.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg max-h-[320px]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Prev Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">New Qty</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Reference</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(entry => (
                  <tr key={entry._id || `${entry.product}_${entry.createdAt}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{entry.movementDate || (entry.createdAt ? entry.createdAt.split('T')[0] : '')}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.productName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.type}</td>
                    <td className="px-3 py-2 text-right">{entry.quantity}</td>
                    <td className="px-3 py-2 text-right">{entry.previousQuantity ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{entry.newQuantity ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{entry.referenceId || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{entry.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No movement entries for the selected filters.</p>
        )}
      </div>
    </div>
  );
};

export default InventoryMovementChart;
