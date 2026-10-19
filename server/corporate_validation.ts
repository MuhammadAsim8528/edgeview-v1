// Shared academic / institutional contamination guards.
// Applied at every enrichment save + fusion boundary so university registrars,
// lecturers, professors, government staff and academic-domain emails can never
// become corporate decision makers, contact persons, or primary contacts.

const INSTITUTIONAL_ROLE_PATTERN =
  /(registrar|professor|lecturer|dean|chancellor|student|principal|academic|researcher|scientist|faculty|head of department|department head|phd|candidate|scholar|tutor|curriculum|admission|library)/i;

const INSTITUTIONAL_NAME_PATTERN =
  /(university|college|institute of|academy|faculty|ministry|department of|government of|public health|national hospital|school of|polytechnic|research centre|research center)/i;

const ACADEMIC_EMAIL_PATTERN =
  /(^|\.)(edu|ac|sch|uni|school)\./i;

const ACADEMIC_TLD_ENDINGS = ['.ac', '.edu', '.sch', '.edu.'];
const ACADEMIC_DOMAIN_PATTERNS = [
  /\.edu(\.|\b)/i,
  /\.ac(\.[a-z]{2})?$/i,
  /\.sch(\.[a-z]{2})?$/i,
  /\.edu\./i,
  /university/i,
  /\.ac\./i,
];

export function getEmailDomain(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const idx = email.indexOf('@');
  if (idx < 0) return '';
  return email.slice(idx + 1).trim().toLowerCase().replace(/^www\./, '');
}

export function isAcademicEmailDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return ACADEMIC_DOMAIN_PATTERNS.some((re) => re.test(d)) || ACADEMIC_EMAIL_PATTERN.test(d);
}

export function isAcademicEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return isAcademicEmailDomain(getEmailDomain(email));
}

export function hasInstitutionalRole(designation: string, name: string = ''): boolean {
  const d = String(designation || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  return INSTITUTIONAL_ROLE_PATTERN.test(d) || INSTITUTIONAL_NAME_PATTERN.test(n);
}

export function isContaminatedPerson(person: {
  name?: string;
  designation?: string;
  emails?: any[];
  email?: string;
}): boolean {
  if (!person || typeof person !== 'object') return true;
  const name = String(person.name || '').trim();
  if (!name || name.length < 2) return true;

  if (hasInstitutionalRole(person.designation, name)) return true;

  const emailValues: string[] = [];
  if (Array.isArray(person.emails)) {
    person.emails.forEach((e) => {
      if (typeof e === 'string') emailValues.push(e);
      else if (e && typeof e === 'object' && e.value) emailValues.push(String(e.value));
    });
  }
  if (typeof person.email === 'string') emailValues.push(person.email);
  if (emailValues.length > 0 && emailValues.every((e) => isAcademicEmail(e))) {
    return true;
  }
  return false;
}

export function filterCleanPeople<T extends { name?: string; designation?: string; emails?: any[]; email?: string }>(
  people: T[]
): T[] {
  if (!Array.isArray(people)) return [];
  return people.filter((p) => !isContaminatedPerson(p));
}

export function filterCleanEmails(emails: string[]): string[] {
  if (!Array.isArray(emails)) return [];
  return emails.filter((e) => typeof e === 'string' && !isAcademicEmail(e));
}