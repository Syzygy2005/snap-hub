import { expect,it } from "vitest";
import { filterEntries,pageHref } from "./filter";
import type { Entry } from "./queries";
const items: Entry[] = Array.from({length:80},(_,i)=>({def_id:`C${i}`,name:`Card ${i}`,ability:"<span>On Reveal</span>: Move a card.",art:"",status:i===0?"unreleased":"released",cost:i%7,power:i,series:"1",tags:[],deckable:true,rarity:""}));
it("combines filters, omits unreleased entries, clamps pages and keeps filters in paging URLs",()=>{
  expect(filterEntries(items,{}).total).toBe(79);
  expect(filterEntries(items,{q:"move",cost:"2",series:"1",category:"deckable"}).items.every(e=>e.cost===2)).toBe(true);
  expect(filterEntries(items,{q:"missing"}).items).toEqual([]);
  expect(filterEntries(items,{page:"999"}).page).toBe(3);
  expect(filterEntries(items,{page:"-2"}).page).toBe(1);
  expect(filterEntries(items,{sort:"power"}).items[0].power).toBe(79);
  expect(pageHref("/wiki/cards",{q:"a & b",cost:"2",page:"1"},2)).toBe("/wiki/cards?q=a+%26+b&cost=2&page=2");
});
