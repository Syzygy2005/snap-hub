/**
 * A hand-written deck guide. Not the same thing as `Archetype` in stats/aggregate.ts, which is a
 * group of real tracked decks with a measured win rate; the two shared a name.
 */
export interface ArchetypeGuide {
  slug:string;title:string;summary:string;mechanic:string;cards:{id:string;name:string;role:string}[];
  plan:[string,string,string];substitutions:string[];mistakes:string[];
}
// Editorial foundations, not live tier rankings or fixed twelve-card recommendations.
export const ARCHETYPES:ArchetypeGuide[]=[
  {slug:"destroy",title:"Destroy",mechanic:"destroy",summary:"Turn your own cards into resources, then cash in on the destruction.",
    cards:[{id:"Carnage",name:"Carnage",role:"Destruction enabler"},{id:"Deathlok",name:"Deathlok",role:"Destruction enabler"},{id:"Wolverine",name:"Wolverine",role:"Reusable destruction target"},{id:"Death",name:"Death",role:"Destruction payoff"}],
    plan:["Set up targets in a lane you can destroy. Keep an extra slot open for the enabler; a full lane cannot accept another card.","Sequence targets before enablers and check every location before committing. Decide which two lanes your eventual power can reach.","Count the power you can actually place in two lanes, including your remaining slots and Energy. A huge single lane does not win the match alone."],
    substitutions:["Start with the destruction targets and enablers you own. Carnage and Deathlok can fill the enabler role, but their stats and resulting boards differ.","Without a premium payoff, use a simpler finishing plan. Replacing Death with a big card does not reproduce her cost reduction; rebuild the Energy curve around the replacement."],
    mistakes:["Destroying a useful card just because an enabler is available.","Filling the target lane before leaving room for the destroy effect.","Snapping on potential combo power without checking opposing disruption or the locations."]},
  {slug:"discard",title:"Discard",mechanic:"discard",summary:"Shape your hand so losing cards advances your winning plan.",
    cards:[{id:"Blade",name:"Blade",role:"Discard enabler"},{id:"LadySif",name:"Lady Sif",role:"Discard enabler"},{id:"Apocalypse",name:"Apocalypse",role:"Discard payoff"},{id:"Swarm",name:"Swarm",role:"Discard payoff"}],
    plan:["Choose a payoff and learn which cards your enablers can discard. Hand order and targeting text matter more than spending all your Energy.","Recheck your hand after every draw or generated card. Use controlled discards when the target is valuable; avoid treating random discards as guaranteed hits.","Plan how to spend both your Energy and board slots. Preserve the finisher your line needs, and count how much power must go into each contested lane."],
    substitutions:["Swap enablers by targeting behavior, not only by cost. A random discard effect is a different risk from a card that selects a particular target.","An Apocalypse plan and a resurrection plan need different hands and payoffs. If you lack the central payoff, change the plan instead of replacing one card and assuming the combo still works."],
    mistakes:["Discarding before checking which card is currently eligible.","Keeping too many expensive payoffs and too few ways to enable them.","Using a discard effect that can remove the only remaining winning play."]},
  {slug:"move",title:"Move",mechanic:"move",summary:"Grow threats and relocate power while keeping room for the next move.",
    cards:[{id:"HumanTorch",name:"Human Torch",role:"Movement payoff"},{id:"Vulture",name:"Vulture",role:"Movement payoff"},{id:"IronFist",name:"Iron Fist",role:"Movement enabler"},{id:"Heimdall",name:"Heimdall",role:"Board repositioning"}],
    plan:["Identify a movement payoff and a legal destination. Sketch the path across the board before filling the early lanes.","Check the exact order of your movement effects. Keep destination slots free and avoid spending an enabler before its intended target is ready.","Calculate the board after movement, not before it. Compare a repositioning finish with simply adding power where it already wins."],
    substitutions:["Choose replacements by direction, timing and target restrictions. Two cards that mention moving may create very different final boards.","If you lack a particular payoff, build around the movement rewards you have and keep enough independent power for games where the combo does not arrive."],
    mistakes:["Moving into a full destination.","Playing a movement finisher automatically when it shifts power out of a winning lane.","Ignoring whether a location permits the planned move."]},
  {slug:"bounce",title:"Bounce",mechanic:"return",summary:"Return cards to hand and reuse their effects for a flexible finish.",
    cards:[{id:"Beast",name:"Beast",role:"Return-to-hand enabler"},{id:"Falcon",name:"Falcon",role:"Return-to-hand enabler"},{id:"Hood",name:"The Hood",role:"Reusable effect"},{id:"Bishop",name:"Bishop",role:"Repeated-play payoff"}],
    plan:["Develop inexpensive effects you want to use again. Leave space for the card that returns them, and remember that returning a card temporarily removes its board power.","Map your hand after the bounce. Count available hand space, the returned cards' actual costs, and how many plays fit into your next turn.","Sequence the final plays around your payoffs and spread power deliberately. Check reveal order before relying on a fragile final board."],
    substitutions:["Falcon and Beast have different target and cost interactions. Read the current text and rebuild your replay turn around the one you own.","Replace an expensive synergy card with an inexpensive useful effect only if the deck still has enough power payoffs. More replayable cards alone do not create a winning finish."],
    mistakes:["Bouncing away a lane you needed to keep ahead.","Planning more replays than your Energy or board slots allow.","Returning cards into a hand with too little space."]},
  {slug:"ongoing",title:"Ongoing",mechanic:"ongoing",summary:"Build a board of persistent effects that reinforce one another.",
    cards:[{id:"AntMan",name:"Ant-Man",role:"Conditional lane payoff"},{id:"CaptainAmerica",name:"Captain America",role:"Ongoing support"},{id:"IronMan",name:"Iron Man",role:"Lane multiplier"},{id:"Spectrum",name:"Spectrum",role:"Ongoing-board payoff"}],
    plan:["Develop useful Ongoing cards across lanes while deciding where the deck's main payoff belongs. Read any conditions before counting the bonus.","Balance concentration and coverage. A multiplier needs power beside it; a board-wide payoff needs eligible cards spread through the board.","Compare finishing lines using the exact current effects. Keep a second lane competitive and consider how opposing ability removal changes your totals."],
    substitutions:["Use the Ongoing cards you own, then choose a payoff that rewards that board. Not every card with the keyword supports the same finishing plan.","An independent high-power card can fill a gap in the curve, but it may receive none of the Ongoing-specific bonuses. Count it separately."],
    mistakes:["Counting conditional bonuses before their conditions are met.","Investing every payoff in one lane.","Assuming an On Reveal finisher will work in a lane that blocks On Reveal abilities."]},
  {slug:"zoo",title:"Zoo",mechanic:"1-cost",summary:"Build a wide board of small cards and make each slot count.",
    cards:[{id:"AntMan",name:"Ant-Man",role:"Low-cost lane payoff"},{id:"SquirrelGirl",name:"Squirrel Girl",role:"Board development"},{id:"KaZar",name:"Ka-Zar",role:"Small-card support"},{id:"BlueMarvel",name:"Blue Marvel",role:"Wide-board support"}],
    plan:["Use inexpensive cards to contest multiple lanes. Reserve space for your support cards and avoid filling every lane before the locations reveal.","Work out which small cards receive each support effect. Spread your resources enough to threaten two lanes without wasting crucial slots.","Place remaining power where it changes a lane result. Consider holding flexible small plays until later when the matchup and your Energy allow it."],
    substitutions:["Replace small utility cards according to the problem you need to solve, while preserving enough eligible cards for your support effects.","If a support card is missing, count the lost power across the whole board. One individually strong replacement may not make up for several missing bonuses."],
    mistakes:["Filling lanes so support cards have nowhere useful to go.","Ignoring effects that remove many small cards at once.","Spending a card in an already-secured lane when another lane is within reach."]},
];
export const archetypeBySlug=(slug:string)=>ARCHETYPES.find(a=>a.slug===slug);
export const LEARNING_LINKS=[
  ...ARCHETYPES.map(a=>({title:a.title,description:a.summary,href:`/wiki/archetypes/${a.slug}`})),
];
