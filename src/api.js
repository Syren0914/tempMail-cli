import axios from 'axios';
import { getConfig } from './config.js';

const BASE = 'https://tempmail-so.p.rapidapi.com';

async function api(method, path, options = {}) {
  const { rk, tk } = getConfig();
  const url = `${BASE}${path}`;
  
  const { headers: extraHeaders, ...restOptions } = options;
  const headers = {
    'x-rapidapi-key': rk,
    'Authorization': `Bearer ${tk}`,
    ...extraHeaders
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      ...restOptions
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

export async function listDomains() {
  const out = await api('GET', '/domains');
  const data = out.data || out;
  return data.map(item => item.name || item.domain).filter(Boolean);
}

export async function createInbox(prefix, domain, minutes = 10) {
  if (!domain) {
    const domains = await listDomains();
    if (!domains.length) throw new Error('No domains available');
    domain = domains[0];
  }
  
  if (!prefix) {
    prefix = 'tm' + Math.random().toString(36).substring(2, 9);
  }

  const lifespan = Math.round(minutes * 60);
  const data = new URLSearchParams({
    address: prefix,
    name: prefix,
    domain,
    lifespan: lifespan.toString()
  });

  const out = await api('POST', '/inboxes', {
    data,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  const payload = out.data || out;
  return {
    inbox_id: payload.id,
    email: `${prefix}@${domain}`,
    created: Math.floor(Date.now() / 1000)
  };
}

export async function deleteInbox(inbox_id) {
  return api('DELETE', `/inboxes/${inbox_id}`);
}

export async function listMails(inbox_id) {
  const out = await api('GET', `/inboxes/${inbox_id}/mails`);
  const payload = out.data || out;
  let data = [];

  if (Array.isArray(payload)) {
    data = payload;
  } else if (typeof payload === 'object') {
    for (const k of ['mails', 'items', 'rows', 'list', 'data']) {
      if (Array.isArray(payload[k])) {
        data = payload[k];
        break;
      }
    }
  }

  return data.map(m => ({
    id: m.id || m._id,
    subject: m.subject || m.title || '(no subject)',
    from: m.from || m.sender || '',
    received: m.received || m.date || ''
  }));
}

export async function readMail(inbox_id, mail_id) {
  const out = await api('GET', `/inboxes/${inbox_id}/mails/${mail_id}`);
  return out.data || out;
}

export async function downloadAttachment(inbox_id, mail_id, attachment_id) {
  // RapidAPI TempMail.so usually returns attachments inside the mail object or via a dedicated path.
  // We'll use the GET /inboxes/{id}/mails/{mid}/attachments/{aid} pattern if supported, 
  // or return the buffer if it's already in the mail object.
  const out = await api('GET', `/inboxes/${inbox_id}/mails/${mail_id}/attachments/${attachment_id}`, {
    responseType: 'arraybuffer'
  });
  return out;
}
