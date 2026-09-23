import { expect,it } from "vitest";
import { boardLeader,cubeStakes } from "./interaction-model";
it("uses lane wins before raw power and total power when lane wins tie",()=>{
  expect(boardLeader([2,2,0],[1,1,100])).toBe("you");
  expect(boardLeader([1,1,100],[2,2,0])).toBe("opponent");
  expect(boardLeader([8,2,3],[5,6,3])).toBe("opponent");
  expect(boardLeader([5,6,3],[8,2,3])).toBe("you");
  expect(boardLeader([8,2,3],[5,5,3])).toBe("tie");
  expect(boardLeader([-2,0,0],[-3,0,0])).toBe("you");
});
it("distinguishes pending snaps from accepted stakes and caps final stakes at eight",()=>{
  expect(cubeStakes(0,false)).toEqual({retreat:1,showdown:2});
  expect(cubeStakes(0,true)).toEqual({retreat:1,showdown:4});
  expect(cubeStakes(1,false)).toEqual({retreat:2,showdown:4});
  expect(cubeStakes(1,true)).toEqual({retreat:2,showdown:8});
  expect(cubeStakes(2,false)).toEqual({retreat:4,showdown:8});
});
