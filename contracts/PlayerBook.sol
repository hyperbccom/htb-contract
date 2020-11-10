pragma solidity  0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
// import '@openzeppelin/contracts/ownership/Ownable.sol';
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./library/NameFilter.sol";
// import "../library/SafeERC20.sol";
import "./library/Governance.sol";
import "./interface/IPlayerBook.sol";

contract PlayerBook is Governance {
    using NameFilter for string;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
 
    // register pools       
    mapping (address => bool) public _pools;

    // (addr => pID) returns player id by address
    mapping (address => uint256) public _pIDxAddr;   
    // (name => pID) returns player id by name      
    mapping (bytes32 => uint256) public _pIDxName;    
    // (pID => data) player data     
    mapping (uint256 => Player) public _plyr;      
    // (pID => name => bool) list of names a player owns.  (used so you can change your display name amoungst any name you own)        
    mapping (uint256 => mapping (bytes32 => bool)) public _plyrNames; 
  
    // total number of players
    uint256 public _pID;
    // total register name count
    uint256 public _totalRegisterCount = 0;

    // the direct refer's reward rate  直接推荐人的奖励率
    uint256 public _referRewardRate = 1000; //10%
    // base rate
    uint256 public _baseRate = 10000;

    // base price to register a name
    uint256 public _registrationBaseFee = 10 finney;     
    // register fee count step
    uint256 public _registrationStep = 100;
    // add base price for one step
    uint256 public _stepFee = 10 finney;     

    bytes32 public _defaulRefer = "hbt";

    address payable public _teamWallet;
  
    struct Player {
        address addr;
        bytes32 name;
        uint8 nameCount;
        uint256 laff;
        uint256 lvCount;
    }

    event eveBindRefer(uint256 pID, address addr, bytes32 name, uint256 affID, address affAddr, bytes32 affName);
    event eveDefaultPlayer(uint256 pID, address addr, bytes32 name);      
    event eveNewName(uint256 pID, address addr, bytes32 name, uint256 affID, address affAddr, bytes32 affName, uint256 balance  );
    event eveAddPool(address addr);
    event eveRemovePool(address addr);


    constructor(address payable teamWallet)
        public
    {
        _pID = 0;
        _teamWallet = teamWallet;
        addDefaultPlayer(_teamWallet,_defaulRefer);
    }

    /**
     * check address
     */
    modifier validAddress( address addr ) {
        require(addr != address(0x0));
        _;
    }

    /**
     * check pool
     */
    modifier isRegisteredPool(){
        require(_pools[msg.sender],"invalid pool address!");
        _;
    }

    // only function for creating additional rewards from dust
    function seize(IERC20 asset) external returns (uint256 balance) {
        balance = asset.balanceOf(address(this));
        asset.safeTransfer(_teamWallet, balance);
    }

    // get register fee 
    function seizeEth() external  {
        uint256 _currentBalance =  address(this).balance;
        _teamWallet.transfer(_currentBalance);
    }
    
    /**
     * revert invalid transfer action
     */
    fallback() external payable {
        revert();
    }

    receive() external payable {
        revert();
    }

    /**
     * registe a pool
     */
    function addPool(address poolAddr)
        onlyGovernance
        public
    {
        require( !_pools[poolAddr], "derp, that pool already been registered");

        _pools[poolAddr] = true;

        emit eveAddPool(poolAddr);
    }
    
    /**
     * remove a pool
     */
    function removePool(address poolAddr)
        onlyGovernance
        public
    {
        require( _pools[poolAddr], "derp, that pool must be registered");

        _pools[poolAddr] = false;

        emit eveRemovePool(poolAddr);
    }

    /**
     * check name string
     * 查询某个名字是否可以注册
     */
    function checkIfNameValid(string memory nameStr)
        public
        view
        returns(bool)
    {
        bytes32 name = nameStr.nameFilter();
        if (_pIDxName[name] == 0)
            return (true);
        else 
            return (false);
    }
    
    /**
     * @dev add a default player
     */
    function addDefaultPlayer(address addr, bytes32 name)
        private
    {        
        _pID++;

        _plyr[_pID].addr = addr;
        _plyr[_pID].name = name;
        _plyr[_pID].nameCount = 1;
        _pIDxAddr[addr] = _pID;
        _pIDxName[name] = _pID;
        _plyrNames[_pID][name] = true;

        //fire event
        emit eveDefaultPlayer(_pID,addr,name);        
    }
    
    /**
     * @dev set refer reward rate
     */
    function setReferRewardRate(uint256 referRate) public  
        onlyGovernance
    {
        _referRewardRate = referRate;
    }

    /**
     * @dev set registration step count
     */
    function setRegistrationStep(uint256 registrationStep) public  
        onlyGovernance
    {
        _registrationStep = registrationStep;
    }

    /**
     * @dev registers a name.  UI will always display the last name you registered.
     * but you will still own all previously registered names to use as affiliate 
     * links.
     * - must pay a registration fee.
     * - name must be unique
     * - names will be converted to lowercase
     * - cannot be only numbers
     * - cannot start with 0x 
     * - name must be at least 1 char
     * - max length of 32 characters long
     * - allowed characters: a-z, 0-9
     * -functionhash- 0x921dec21 (using ID for affiliate)
     * -functionhash- 0x3ddd4698 (using address for affiliate)
     * -functionhash- 0x685ffd83 (using name for affiliate)
     * @param nameString players desired name
     * @param affCode affiliate name of who refered you
     * (this might cost a lot of gas)
     */

    /**
    参数类型：(string memory nameString, string memory affCode) //自己的名字，邀请人的名字
说明：如果邀请人的名字为“”意味着没有邀请者
	每一次注册是需要支付手续费的，【0，99）号用户收取100 finney，【100，199）200 ～
     */
    function registerNameXName(string memory nameString, string memory affCode)
        public
        payable 
    {

        // make sure name fees paid
        require (msg.value >= this.getRegistrationFee(), "umm.....  you have to pay the name fee");

        // filter name + condition checks
        bytes32 name = NameFilter.nameFilter(nameString);
        // if names already has been used
        require(_pIDxName[name] == 0, "sorry that names already taken");

        // set up address 
        address addr = msg.sender;
         // set up our tx event data and determine if player is new or not
        _determinePID(addr);
        // fetch player id
        uint256 pID = _pIDxAddr[addr];
        // if names already has been used
        require(_plyrNames[pID][name] == false, "sorry that names already taken");

        // add name to player profile, registry, and name book
        _plyrNames[pID][name] = true;
        _pIDxName[name] = pID;   
        _plyr[pID].name = name;
        _plyr[pID].nameCount++;

        _totalRegisterCount++;


        //try bind a refer
        if(_plyr[pID].laff == 0){

            bytes memory tempCode = bytes(affCode);
            bytes32 affName = 0x0;
            if (tempCode.length >= 0) {
                assembly {
                    affName := mload(add(tempCode, 32))
                }
            }

            _bindRefer(addr,affName);
        }
        uint256 affID = _plyr[pID].laff;

        // fire event
        emit eveNewName(pID, addr, name, affID, _plyr[affID].addr, _plyr[affID].name, _registrationBaseFee );
    }
    
    /**
     * @dev bind a refer,if affcode invalid, use default refer
     */  
    function bindRefer( address from, string calldata  affCode )
        isRegisteredPool()
        external
        // override
        returns (bool)
    {

        bytes memory tempCode = bytes(affCode);
        bytes32 affName = 0x0;
        if (tempCode.length >= 0) {
            assembly {
                affName := mload(add(tempCode, 32))
            }
        }

        return _bindRefer(from, affName);
    }


    /**
     * @dev bind a refer,if affcode invalid, use default refer
     */  
    function _bindRefer( address from, bytes32  name )
        validAddress(msg.sender)    
        validAddress(from)  
        private
        returns (bool)
    {
        // set up our tx event data and determine if player is new or not
        _determinePID(from);

        // fetch player id
        uint256 pID = _pIDxAddr[from];
        if( _plyr[pID].laff != 0){
            return false;
        }

        if (_pIDxName[name] == 0){
            //unregister name 
            name = _defaulRefer;
        }
      
        uint256 affID = _pIDxName[name];
        if( affID == pID){
            affID = _pIDxName[_defaulRefer];
        }
       
        _plyr[pID].laff = affID;
        //lvcount
        _plyr[affID].lvCount++;
        // fire event
        emit eveBindRefer(pID, from, name, affID, _plyr[affID].addr, _plyr[affID].name);

        return true;
    }
    
    //
    function _determinePID(address addr)
        private
        returns (bool)
    {
        if (_pIDxAddr[addr] == 0)
        {
            _pID++;
            _pIDxAddr[addr] = _pID;
            _plyr[_pID].addr = addr;
            
            // set the new player bool to true
            return (true);
        } else {
            return (false);
        }
    }
    
    function hasRefer(address from) 
        isRegisteredPool()
        external 
        // override
        returns(bool) 
    {
        _determinePID(from);
        uint256 pID =  _pIDxAddr[from];
        return (_plyr[pID].laff > 0);
    }

    //查询某个用户的名字
    function getPlayerName(address from)
        external
        view
        returns (bytes32)
    {
        uint256 pID =  _pIDxAddr[from];
        if(_pID==0){
            return "";
        }
        return (_plyr[pID].name);
    }

    //查询某个用户的邀请者地址
    function getPlayerLaffAddress(address from) external  view returns(address laffAddress) {
        uint256 pID =  _pIDxAddr[from];
        if(_pID==0){
            return _teamWallet;
        }
        uint256 laffID = _plyr[pID].laff;
        if(laffID == 0) {
            return _teamWallet;
        }
        return _plyr[laffID].addr;
    }

    //查询某个用户的邀请者的地址
    function getPlayerLaffName(address from)
        external
        view
        returns (bytes32)
    {
        uint256 pID =  _pIDxAddr[from];
        if(_pID==0){
             return "";
        }

        uint256 aID=_plyr[pID].laff;
        if( aID== 0){
            return "";
        }

        return (_plyr[aID].name);
    }

    //查询某个用户的id，邀请者id，邀请数量
    function getPlayerInfo(address from)
        external
        view
        returns (uint256,uint256,uint256)
    {
        uint256 pID = _pIDxAddr[from];
        if(_pID==0){
             return (0,0,0);
        }
        return (pID,_plyr[pID].laff,_plyr[pID].lvCount);
    }

    //获取当前注册费用
    function getRegistrationFee()
        external
        view
        returns (uint256)
    {
        if( _totalRegisterCount <_registrationStep || _registrationStep == 0){
            return _registrationBaseFee;
        }
        else{
            uint256 step = _totalRegisterCount.div(_registrationStep);
            return _registrationBaseFee.add(step.mul(_stepFee));
        }
    }
}