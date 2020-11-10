pragma solidity  0.6.12;


interface IPlayerBook {
    function settleReward( address from,uint256 amount ) external returns (uint256);
    function bindRefer( address from,string calldata  affCode ) external  returns (bool);
    function hasRefer(address from)  external returns(bool);
    function getPlayerLaffAddress(address from) external returns(address); 

}