import type { OwaspCell } from '@/types';

// OWASP Top 10 2021 — A01 ~ A10
export const OWASP_TOP10: OwaspCell[] = [
  { id: 'A01', name: 'Access Control',  status: 'hit'     },
  { id: 'A02', name: 'Crypto Failures', status: 'hit'     },
  { id: 'A03', name: 'Injection',       status: 'hit'     },
  { id: 'A04', name: 'Insec. Design',   status: 'partial' },
  { id: 'A05', name: 'Misc. Config',    status: 'partial' },
  { id: 'A06', name: 'Vuln. Comp.',     status: 'none'    },
  { id: 'A07', name: 'Auth Failure',    status: 'hit'     },
  { id: 'A08', name: 'Data Integrity',  status: 'none'    },
  { id: 'A09', name: 'Logging',         status: 'partial' },
  { id: 'A10', name: 'SSRF',            status: 'none'    },
];
