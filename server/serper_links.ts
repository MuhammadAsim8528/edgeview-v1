import {isSafeExternalUrl} from './url_safety';
import {providerSchemaError} from './provider_response';

/** Google's October2026 opaque links must be resolved by Serper, never decoded
 * or followed as though they were the cited company's original URL. */
export function isSerperGoogleRedirect(value: unknown): boolean {
  if(typeof value!=='string')return false;
  try { const url=new URL(value);return ['google.com','www.google.com'].includes(url.hostname.toLowerCase())&&url.pathname.toLowerCase()==='/goto'; }
  catch{return false;}
}

/** Only substitute the link of the same original organic item. Titles, ranks,
 * snippets and already-real links remain the original search evidence. */
export function serperLinkSubstitutions(original: unknown, resolved: unknown): Map<number,string> {
  const first=(original as any)?.organic, second=(resolved as any)?.organic;
  if(!Array.isArray(first)||!Array.isArray(second)||first.length!==second.length)throw providerSchemaError('Serper resolution changed the organic result shape');
  const links=new Map<number,string>();
  for(let index=0;index<first.length;index++){
    if(!isSerperGoogleRedirect(first[index]?.link))continue;
    const next=second[index];
    if(!next||typeof next!=='object'||['position','title','snippet'].some(key=>
      Object.hasOwn(first[index],key)&&(!Object.hasOwn(next,key)||first[index][key]!==next[key])))throw providerSchemaError('Serper resolution changed result identity');
    if(typeof next.link==='string'&&!isSerperGoogleRedirect(next.link)&&isSafeExternalUrl(next.link))links.set(index,next.link);
  }
  return links;
}
