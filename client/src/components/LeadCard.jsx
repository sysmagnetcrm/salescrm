import { Phone, Mail, Globe2, Package, Calendar, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext.jsx';

// Helpers to format phone numbers with country codes
// Helpers to format phone numbers with country codes
const getDialCode = (country) => {
  return '+91';
};

const ensureE164 = (phone, country) => {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (raw.startsWith('+')) {
    return `+${raw.replace(/[^0-9]/g, '')}`;
  }
  if (raw.startsWith('00')) {
    return `+${raw.replace(/[^0-9]/g, '').replace(/^00/, '')}`;
  }
  const digits = raw.replace(/[^0-9]/g, '');
  const code = getDialCode(country);
  return `${code}${digits}`;
};

const buildWhatsAppNumber = (phone, country) => ensureE164(phone, country).replace(/\D/g, '');

import { startCrmCall } from '../services/api';

const LeadCard = ({ lead, onClick }) => {
  const { user } = useAuth();
  const statusColors = {
    fresh: 'status-fresh',
    'follow-up': 'status-follow-up',
    rnr: 'bg-purple-50 border-purple-200',
    dead: 'status-dead',
    closed: 'status-closed',
    cancelled: 'status-dead',
    rejected: 'status-dead'
  };

  const statusLabels = {
    fresh: 'Fresh',
    'follow-up': 'Follow-up',
    rnr: 'RNR',
    dead: 'Dead',
    closed: 'Registered',
    cancelled: 'Cancelled',
    rejected: 'Rejected'
  };

  const handleCall = (e) => {
    e.stopPropagation();
    startCrmCall(lead);
  };

  const adv = lead?.value !== undefined && lead?.value !== null ? parseFloat(lead.value) : NaN;
  if (typeof window !== 'undefined') {
    // Temporary debug to verify card receives the right value
    try { console.debug('[LeadCard]', lead?.id, 'value:', lead?.value, 'parsed:', adv); } catch { }
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 md:p-4 rounded-lg cursor-pointer transition-all hover:shadow md:hover:shadow-lg ${statusColors[lead.status]}`}
    >
      <div className="flex justify-between items-start mb-2 md:mb-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">
            {lead.name}
            {(lead.salesperson?.name || user?.name) && (
              <span className="inline lg:hidden text-xs font-normal text-gray-600"> • {lead.salesperson?.name || user?.name}</span>
            )}
          </h3>
          {/* Mobile/iPad combined Country • Product */}
          <div className="flex lg:hidden items-center text-xs text-gray-600 mt-1">
            <Globe2 className="h-4 w-4 mr-1" />
            <span>{lead.country || '-'}{lead.product ? ` • ${lead.product}` : ''}</span>
          </div>
          {/* Desktop separate rows for country and product */}
          {lead.country && (
            <div className="hidden lg:flex items-center text-sm text-gray-600 mt-1">
              <Globe2 className="h-4 w-4 mr-1" />
              {lead.country}
            </div>
          )}
          {lead.product && (
            <div className="hidden lg:flex items-center text-sm text-gray-600 mt-1">
              <Package className="h-4 w-4 mr-1" />
              {lead.product}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={`px-2.5 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold ${lead.status === 'fresh' ? 'bg-gray-200 text-gray-800' :
              lead.status === 'follow-up' ? 'bg-orange-200 text-orange-800' :
                lead.status === 'rnr' ? 'bg-purple-200 text-purple-800' :
                  (lead.status === 'dead' || lead.status === 'cancelled' || lead.status === 'rejected') ? 'bg-red-200 text-red-800' :
                    'bg-green-200 text-green-800'
            }`}>
            {statusLabels[lead.status]}
          </span>
          {/* Mobile call/WhatsApp quick actions */}
          <div className="inline-flex lg:hidden items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
            {lead.phone && (
              <button
                onClick={(e) => handleCall(e)}
                className="p-1.5 rounded-full bg-white shadow border border-gray-200 text-gray-700 hover:bg-gray-50"
                title="Initiate CRM Call"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            {lead.phone && (
              <a
                href={`https://wa.me/${buildWhatsAppNumber(lead.phone, lead.country)}`}
                className="p-1.5 rounded-full bg-green-500 text-white shadow hover:bg-green-600"
                title="WhatsApp"
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="hidden lg:flex items-center text-sm text-gray-700">
          <Phone className="h-4 w-4 mr-2 text-primary-600" />
          <button
            onClick={(e) => handleCall(e, lead.phone, lead.country)}
            className="hover:text-primary-600 font-medium truncate"
          >
            {ensureE164(lead.phone, lead.country)}
          </button>
        </div>

        {lead.email && (
          <div className="hidden md:flex items-center text-sm text-gray-700">
            <Mail className="h-4 w-4 mr-2 text-primary-600" />
            <a href={`mailto:${lead.email}`} className="hover:text-primary-600">
              {lead.email}
            </a>
          </div>
        )}

        {lead.lastCalled && (
          <div className="hidden lg:flex items-center text-xs md:text-sm text-gray-700">
            <Calendar className="h-4 w-4 mr-2 text-orange-600" />
            <span>Last called: {format(new Date(lead.lastCalled), 'MMM dd, yyyy')}</span>
          </div>
        )}
      </div>

      {/* Mobile/iPad bottom meta */}
      <div className="mt-2 lg:hidden text-[11px] text-gray-600">
        <span>Uploaded: {lead?.createdAt ? format(new Date(lead.createdAt), 'MMM dd, yyyy') : '-'}</span>
        <span> • </span>
        <span>Last follow up: {lead?.lastCalled ? format(new Date(lead.lastCalled), 'MMM dd, yyyy') : '-'}</span>
      </div>

      {(lead?.createdAt || !isNaN(adv)) && (
        <div className="hidden lg:block mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-200">
          {!isNaN(adv) && (
            <span className="text-sm font-semibold text-gray-900 block">
              Advance: {adv.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
            </span>
          )}
          {lead?.createdAt && (
            <div className="text-xs text-gray-500 mt-1">
              Uploaded: {format(new Date(lead.createdAt), 'MMM dd, yyyy')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadCard;
