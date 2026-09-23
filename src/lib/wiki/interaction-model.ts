export function boardLeader(yours:readonly number[],theirs:readonly number[]):"you"|"opponent"|"tie" {
  const wins=yours.filter((power,i)=>power>theirs[i]).length,losses=yours.filter((power,i)=>power<theirs[i]).length;
  if(wins!==losses)return wins>losses?"you":"opponent";
  const difference=yours.reduce((total,power,i)=>total+power-theirs[i],0);
  return difference===0?"tie":difference>0?"you":"opponent";
}
// Final-turn example: pending snap has not been accepted by ending the turn.
export function cubeStakes(accepted:0|1|2,pending:boolean){
  const snaps=Math.min(2,accepted+(pending?1:0));
  return {retreat:2**accepted,showdown:2**(snaps+1)};
}
