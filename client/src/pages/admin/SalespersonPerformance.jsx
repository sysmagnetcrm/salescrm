import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userAPI, leadAPI } from '../../services/api';
import { ArrowLeft, Phone, UserCheck, PhoneMissed, UserPlus, CheckCircle } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className={`p-6 rounded-lg shadow-sm border ${color} bg-white`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('200', '100')}`}>
                <Icon className={`h-6 w-6 ${color.replace('border-', 'text-').replace('200', '600')}`} />
            </div>
        </div>
    </div>
);

const SalespersonPerformance = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('weekly');
    const [data, setData] = useState(null);
    const [leads, setLeads] = useState([]);
    const [loadingLeads, setLoadingLeads] = useState(false);

    useEffect(() => {
        fetchPerformance();
    }, [id, period]);

    useEffect(() => {
        fetchLeads();
    }, [id]);

    const fetchPerformance = async () => {
        setLoading(true);
        try {
            const response = await userAPI.getDetailedPerformance(id, period);
            setData(response.data.data);
        } catch (error) {
            toast.error('Failed to load performance data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeads = async () => {
        setLoadingLeads(true);
        try {
            // Fetch specifically assigned leads
            const response = await leadAPI.getAllLeads({
                assignedTo: id,
                limit: 100 // Limit to 100 for performance overview
            });
            setLeads(response.data.data);
        } catch (error) {
            console.error('Failed to load leads', error);
        } finally {
            setLoadingLeads(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'fresh': return 'bg-gray-100 text-gray-800';
            case 'follow-up': return 'bg-orange-100 text-orange-800';
            case 'closed': return 'bg-green-100 text-green-800';
            case 'dead': return 'bg-red-100 text-red-800';
            case 'registered': return 'bg-blue-100 text-blue-800';
            case 'rnr': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!data) return null;

    // Prepare Pie Data
    const pieData = [
        { name: 'Fresh Leads', value: data.stats.fresh, color: '#9CA3AF' },
        { name: 'Follow-ups', value: data.stats.followUps, color: '#F97316' },
        { name: 'RNR', value: data.stats.rnr, color: '#A855F7' },
        { name: 'Registered', value: data.stats.registered, color: '#22C55E' }
    ].filter(d => d.value > 0);

    // Prepare Trend Data (ensure history exists)
    const trendData = data.history || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/salespeople')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Performance Report</h1>
                        <p className="text-gray-500">{data.user.name}</p>
                    </div>
                </div>

                {/* Period Selector */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                    {['daily', 'weekly', 'monthly'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${period === p
                                    ? 'bg-white text-primary-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <StatCard
                    title="Total Calls"
                    value={data.stats.calls}
                    icon={Phone}
                    color="border-blue-200"
                />
                <StatCard
                    title="Fresh Leads"
                    value={data.stats.fresh}
                    icon={UserPlus}
                    color="border-gray-200"
                />
                <StatCard
                    title="Follow-ups"
                    value={data.stats.followUps}
                    icon={UserCheck}
                    color="border-orange-200"
                />
                <StatCard
                    title="RNR"
                    value={data.stats.rnr}
                    icon={PhoneMissed}
                    color="border-purple-200"
                />
                <StatCard
                    title="Registered"
                    value={data.stats.registered}
                    icon={CheckCircle}
                    color="border-green-200"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Activity Trends</h3>
                    <div className="h-80">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#F3F4F6' }}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="calls" name="Calls" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="followUps" name="Follow-ups" fill="#F97316" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="registered" name="Registered" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400">
                                No activity data for this period
                            </div>
                        )}
                    </div>
                </div>

                {/* Distribution Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Status Distribution</h3>
                    <div className="h-80">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400">
                                No data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assigned Leads Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Assigned Leads ({leads.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    {loadingLeads ? (
                        <div className="p-8 text-center text-gray-500">Loading leads...</div>
                    ) : leads.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No leads assigned to this salesperson found.</div>
                    ) : (
                        <table className="w-full text-left bg-white">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Phone</th>
                                    <th className="px-6 py-3">Source</th>
                                    <th className="px-6 py-3">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(lead.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {lead.name}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {lead.phone}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {lead.source || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            ${lead.value?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalespersonPerformance;
