pragma solidity 0.6.12;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PlayerBook.sol";
import "./HBTToken.sol";
import "./HBTLock.sol";


interface IMigratorChef {
    // Perform LP token migration from legacy UniswapV2 to SushiSwap.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to UniswapV2 LP tokens.
    // SushiSwap must mint EXACTLY the same amount of SushiSwap LP tokens or
    // else something bad will happen. Traditional UniswapV2 does not
    // do that so be careful!
    function migrate(IERC20 token) external returns (IERC20);
}

// MasterChef is the master of Hbt. He can make Hbt and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once HBT is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChef is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.        奖励的债务
        //
        // We do some fancy math here. Basically, any point in time, the amount of HBTs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accHbtPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accHbtPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.  LP token 合约地址.
        uint256 allocPoint;       // How many allocation points assigned to this pool. HBTs to distribute per block.  分配给该池的分配点数
        uint256 lastRewardBlock;  // Last block number that HBTs distribution occurs.   YMI分配发生的最后一个块号。
        uint256 accHbtPerShare; // Accumulated HBTs per share, times 1e12. See below.  每股累计的YMI
    }

    // The HBT TOKEN!
    HBTToken public hbt;
    // The HBTLock Contract.
    HBTLock public hbtLock;
    // Dev address.
    // address public devaddr;
    // Block number when bonus HBT period ends.
    uint256 public bonusEndBlock;
    // HBT tokens created per block.
    uint256 public hbtPerBlock;
    // Bonus muliplier for early hbt makers.
    uint256 public constant BONUS_MULTIPLIER = 1;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when HBT mining starts.
    uint256 public startBlock;

    mapping (uint256 => mapping (address => uint256)) public userRewardInfo;

    PlayerBook public playerBook;
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event ProfitLock(address indexed user, uint256 indexed pid, uint256 pt, uint256 times);
    event ExtractReward(address indexed user, uint256 indexed pid, uint256 amount);
    event PlayerBookEvent(address indexed user, address indexed fromUser, uint256 amount);


    constructor(
        HBTToken _hbt, //HBT Token合约地址
        HBTLock _hbtLock, //HBTLock 合约地址
        uint256 _hbtPerBlock, //每个块产生的HBT Token的数量
        uint256 _startBlock,  //开挖HBT的区块高度
        uint256 _bonusEndBlock, //HBT倍数结束块
        address payable _playerBook
    ) public {
        hbt = _hbt;
        hbtLock = _hbtLock;
        hbtPerBlock = _hbtPerBlock;
        bonusEndBlock = _bonusEndBlock;
        startBlock = _startBlock;

        playerBook = PlayerBook(_playerBook);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function getUserRewardInfo(uint256 _pid,address _address) external view returns (uint256) {
        return userRewardInfo[_pid][_address];
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    //添加新的LP 交易池， 仅合约拥有者可以调用，注意，不能添加相同地址的LP 交易池
    //param: _allocPoint, 分配的点数(即每个池的占比为：当前分配点数 / 总点数)
    //param: _lpToken, LP Token合约的地址
    //param: _withUpdate, 是否更新交易池（备注：查询sushi的交易，一般都是传true）
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accHbtPerShare: 0
        }));
    }

    // Update the given pool's HBT allocation point. Can only be called by the owner.
    //设置交易池的分配点数, 仅合约拥有者可以调用
    //param： _pid， pool id (即通过pool id 可以找到对应池的的地址)
    //param：_allocPoint， 新的分配点数
    //param: _withUpdate, 是否更新交易池（备注：查询sushi的交易，一般都是传true）
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Set the migrator contract. Can only be called by the owner.
    //设置迁移合约,  仅合约拥有者可以调用
    //param：_migrator，迁移合约的地址
    function setMigrator(IMigratorChef _migrator) public onlyOwner {
        migrator = _migrator;
    }

    // Migrate lp token to another lp contract. Can be called by anyone. We trust that migrator contract is good.
    //将lp token迁移到另一个lp token, 需要谨慎操作
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "migrate: no migrator");
        PoolInfo storage pool = poolInfo[_pid];
        IERC20 lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        pool.lpToken = newLpToken;
    }

    // Return reward multiplier over the given _from to _to block.
    //查询接口， 获取_from到_to区块之间过了多少区块，并计算乘数
    //param：_from from 区块高度
    //param：_to to 区块高度
    // function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
    //     if (_to <= bonusEndBlock) {
    //         return _to.sub(_from).mul(BONUS_MULTIPLIER);
    //     } else if (_from <= bonusEndBlock) {
    //         return bonusEndBlock.sub(_from);
    //     } else {
    //         return 0;
    //     }
    // }
        // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                _to.sub(bonusEndBlock)
            );
        }
    }

    // View function to see pending HBTs on frontend.
    //查询接口，查询当前阶段指定地址_user在_pid池中赚取的YMI
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    //param：_user， 用户地址
    function pendingHbt(uint256 _pid, address _user) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accHbtPerShare = pool.accHbtPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 hbtReward = multiplier.mul(hbtPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accHbtPerShare = accHbtPerShare.add(hbtReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accHbtPerShare).div(1e12).sub(user.rewardDebt);
    }

    //前端页面查询接口，扣除返佣
    function pendingHbtShow(uint256 _pid, address _user) external view returns (uint256) {

        uint256 pending = pendingHbt(_pid,_user);
        uint256 baseRate = playerBook._baseRate();
        uint256 referRewardRate = playerBook._referRewardRate();
        uint256 toRefer = pending.mul(referRewardRate).div(baseRate);
        return pending.sub(toRefer).add(userRewardInfo[_pid][_user]);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    //更新所有池的奖励等信息
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    //更新将指定池奖励等信息
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 hbtReward = multiplier.mul(hbtPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        // hbt.allowMint(devaddr, hbtReward.div(10));
        hbt.allowMint(address(this), hbtReward);
        pool.accHbtPerShare = pool.accHbtPerShare.add(hbtReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for HBT allocation.
    //抵押LP toekn 进行挖矿获取YMI（抵押前，当前操作地址需要先在对应的LP toekn合约进行授权给MasterChef合约）
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    //param：_amount, 抵押的金额
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accHbtPerShare).div(1e12).sub(user.rewardDebt);
            // safeHbtTransfer(msg.sender, pending);
            address refer = playerBook.getPlayerLaffAddress(msg.sender);
            uint256 referRewardRate = playerBook._referRewardRate();
            uint256 baseRate = playerBook._baseRate();
            uint256 toRefer = pending.mul(referRewardRate).div(baseRate);
            // safeHbtTransfer(msg.sender, pending.sub(toRefer));
            userRewardInfo[_pid][msg.sender] = userRewardInfo[_pid][msg.sender].add(pending.sub(toRefer));
            safeHbtTransfer(refer, toRefer);
            emit PlayerBookEvent(refer, msg.sender, toRefer);
        }
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accHbtPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    //当前地址提取LP token 
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    //param：_amount, 提取的金额
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);

        //user.amount 减少 会影响收益
        uint256 pending = user.amount.mul(pool.accHbtPerShare).div(1e12).sub(user.rewardDebt);
        address refer = playerBook.getPlayerLaffAddress(msg.sender);
        uint256 referRewardRate = playerBook._referRewardRate();
        uint256 baseRate = playerBook._baseRate();
        uint256 toRefer = pending.mul(referRewardRate).div(baseRate);
        // safeHbtTransfer(msg.sender, pending.sub(toRefer));
        userRewardInfo[_pid][msg.sender] = userRewardInfo[_pid][msg.sender].add(pending.sub(toRefer));
        safeHbtTransfer(refer, toRefer);
        emit PlayerBookEvent(refer, msg.sender, toRefer);
        
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHbtPerShare).div(1e12);
        if(_amount > 0){
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
            emit Withdraw(msg.sender, _pid, _amount);
        }
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    //当前地址紧急提取指定池的LP Token，但得不到任何YMI,谨慎使用
    //param：_pid，  pool id (即通过pool id 可以找到对应池的的地址)
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe hbt transfer function, just in case if rounding error causes pool to not have enough HBTs.
    function safeHbtTransfer(address _to, uint256 _amount) internal {
        uint256 hbtBal = hbt.balanceOf(address(this));
        if (_amount > hbtBal) {
            hbt.transfer(_to, hbtBal);
        } else {
            hbt.transfer(_to, _amount);
        }
        // hbt.transfer(_to, _amount);
    }

 
    //提取收益&延时提取
    function extractReward(uint256 _pid, uint256 _times, bool _profitLock) public {

        withdraw(_pid,0);

        // PoolInfo storage pool = poolInfo[_pid];
        // UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 pending = userRewardInfo[_pid][msg.sender];

        if (_profitLock == false) {
            safeHbtTransfer(msg.sender, pending);
            emit ExtractReward(msg.sender, _pid, pending);
        } else {
            uint256 _pendingTimes = pending.mul(_times).div(10);
            hbt.allowMint(address(this), _pendingTimes.sub(pending));

            safeHbtTransfer(address(hbtLock), _pendingTimes);
            hbtLock.disposit(msg.sender,pending,_times);
            emit ProfitLock(msg.sender, _pid, pending, _times);
        }

        userRewardInfo[_pid][msg.sender] = 0;
    }
}