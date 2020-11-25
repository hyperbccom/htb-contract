const { expectRevert, time } = require('@openzeppelin/test-helpers');
const HBTToken = artifacts.require('HBTToken');
const MasterChef = artifacts.require('MasterChef');
const MockERC20 = artifacts.require('MockERC20');
const HBTLock = artifacts.require('HBTLock');
const PlayerBook = artifacts.require('PlayerBook');

contract('MasterChef', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.hbt = await HBTToken.new({ from: alice });
        this.hbtLock = await HBTLock.new(this.hbt.address,{ from: alice });
        this.playerBook = await PlayerBook.new(minter,{ from: alice });

    });

    it('设置正确的状态变量', async () => {
        this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '1000', '0', '1000',this.playerBook.address, { from: alice });
        // await this.hbt.transferOwnership(this.chef.address, { from: alice }); //这个地方和sushi不一样，hbttoken的owner权限没有给masterchef，而是需要加入hbttoken白名单
        const hbt = await this.chef.hbt();
        // const devaddr = await this.chef.devaddr();
        // const owner = await this.hbt.owner();

        assert.equal(hbt.valueOf(), this.hbt.address);
        // assert.equal(devaddr.valueOf(), dev);
        // assert.equal(owner.valueOf(), this.chef.address);

        //添加htbToken白名单
        this.hbt.setAllowMintAddr(this.chef.address,true);
        const isAllowAddress = await this.hbt.allowMintAddr(this.chef.address);
        assert.equal(isAllowAddress.valueOf(),true);
    });

    context('将ERC/LP令牌添加到字段中', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('紧急赎回LP/ERC20', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '100', '100', '1000',this.playerBook.address, { from: alice });

            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.chef.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await this.chef.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('在农耕结束后才分发HBT', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '100', '100', '1000',this.playerBook.address, { from: alice });

            // await this.hbt.transferOwnership(this.chef.address, { from: alice });
            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.chef.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await this.chef.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await this.chef.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await this.chef.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('100');
            // console.log("pendingHbt",(await this.chef.pendingHbt(0,bob)).valueOf());
            // console.log("balanceOf",(await this.hbt.balanceOf(bob)).valueOf());
            await this.chef.deposit(0, '0', { from: bob }); // block 101
            // assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '100');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'90')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '10');
            await time.advanceBlockTo('104');
            // console.log("pendingHbt",(await this.chef.pendingHbt(0,bob)).valueOf());
            await this.chef.deposit(0, '0', { from: bob }); // block 105
            // assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '500');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'450')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '50');
            await this.chef.extractReward(0, 0, false, { from: bob });
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '540');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '600');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'0')
        });

        it('有人赎回、抵押才发HBTToken', async () => {
            // 100 per block farming rate starting at block 200 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '100', '200', '1000',this.playerBook.address, { from: alice });

            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await time.advanceBlockTo('199');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('204');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('209');
            await this.chef.deposit(0, '10', { from: bob }); // block 210
            assert.equal((await this.hbt.totalSupply()).valueOf(), '0');
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '0');
            // assert.equal((await this.hbt.balanceOf(dev)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '990');
            await time.advanceBlockTo('219');

            await this.chef.withdraw(0, '10', { from: bob }); // block 220
            assert.equal((await this.hbt.totalSupply()).valueOf(), '1000');
            // assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '900');

            // // assert.equal((await this.hbt.balanceOf(dev)).valueOf(), '100');
            // assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'900')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '100');
            await this.chef.extractReward(0, 0, false, { from: bob });
            // console.log("(await this.hbt.balanceOf(bob)).valueOf()",(await this.hbt.balanceOf(bob)).valueOf().toString(),(await this.hbt.totalSupply()).valueOf().toString())
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '900');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '1000');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'0')
        });

        it('普通用户先进行赎回本金', async () => {
            // 100 per block farming rate starting at block 200 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '100', '200', '1000',this.playerBook.address, { from: alice });

            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await time.advanceBlockTo('300');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('301');
            assert.equal((await this.hbt.totalSupply()).valueOf(), '0');
            await time.advanceBlockTo('302');
            await this.chef.deposit(0, '10', { from: bob }); // block 210
            await this.chef.deposit(0, '10', { from: alice }); // block 210
            await this.chef.withdraw(0, '10', { from: bob }); // block 220

        });

        it('为每个投资者发放收益', async () => {
            // 1000 per block farming rate starting at block 300 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '1000', '400', '1000',this.playerBook.address, { from: alice });

            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.chef.add('100', this.lp.address, true);
            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.lp.approve(this.chef.address, '1000', { from: bob });
            await this.lp.approve(this.chef.address, '1000', { from: carol });

            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('409');
            await this.chef.deposit(0, '10', { from: alice }); 

            // Bob deposits 20 LPs at block 414
            await time.advanceBlockTo('413');
            await this.chef.deposit(0, '20', { from: bob });

            // // Carol deposits 30 LPs at block 418
            await time.advanceBlockTo('417');
            await this.chef.deposit(0, '30', { from: carol });

            // Alice deposits 10 more LPs at block 420. At this point:
            // Alice获得 (4*1000+4*10/(10+20)*1000 + 2*10/(10+20+30)*1000)*0.9 = 5100
            // minter默认邀请人:  (4*1000+4*10/(10+20)*1000+2*10/(10+20+30)*1000)*0.1 = 566
            // // MasterChef 余额: 10000 - 1000 = 9000
            await time.advanceBlockTo('419')
            await this.chef.deposit(0, '10', { from: alice });
            assert.equal((await this.hbt.totalSupply()).valueOf(), '10000');
            assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '0');
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.hbt.balanceOf(carol)).valueOf(), '0');
            // console.log("(await this.hbt.balanceOf(this.chef.address)).valueOf()",(await this.hbt.balanceOf(this.chef.address)).valueOf().toString())
            // console.log("(await this.chef.getUserRewardInfo(0,alice)).valueOf()",(await this.chef.getUserRewardInfo(0,alice)).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString())
            assert.equal((await this.hbt.balanceOf(this.chef.address)).valueOf(), '9434');
            assert.equal((await this.chef.getUserRewardInfo(0,alice)).valueOf(),'5100')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '566');



            // Bob withdraws 5 LPs at block 430. At this point:
            // Bob 获得: ((418-414)*20/(10+20)*1000 + (420-418)*20/(10+20+30)*1000 + (430-420)*20/(10+20+30+10)*1000)*0.9 = 5571
            // minter默认邀请人: ((418-414)*20/(10+20)*1000 + (420-418)*20/(10+20+30)*1000 + (430-420)*20/(10+20+30+10)*1000)*0.1+566 = 1185
            await time.advanceBlockTo('429')
            await this.chef.withdraw(0, '5', { from: bob });
            // console.log("(await this.hbt.totalSupply()).valueOf()",(await this.hbt.totalSupply()).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(this.chef.address)).valueOf()",(await this.hbt.balanceOf(this.chef.address)).valueOf().toString())
            // console.log("(await this.chef.getUserRewardInfo(0,bob)).valueOf()",(await this.chef.getUserRewardInfo(0,bob)).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString())
            assert.equal((await this.hbt.totalSupply()).valueOf(), '20000');
            assert.equal((await this.hbt.balanceOf(this.chef.address)).valueOf(), '18815');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'5571')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '1185');


            // Alice withdraws 20 LPs at block 440.
            //minter默认邀请人：((430-420)*20/(10+20+30+10)*1000+(440-430)*20/(10+20+30+10-5)*1000)*0.1 = 593
            //Alice 获得：((430-420)*20/(10+20+30+10)*1000+(440-430)*20/(10+20+30+10-5)*1000)-593 = 5341
            await time.advanceBlockTo('439')
            // console.log("befroe-(await this.chef.getUserRewardInfo(0,alice)).valueOf()",(await this.chef.getUserRewardInfo(0,alice)).valueOf().toString());
            // console.log("befroe-(await this.chef.pendingHbt(0,alice)).valueOf()",(await this.chef.pendingHbt(0,alice)).valueOf().toString());
            // console.log("befroe-(await this.chef.pendingHbtShow(0,alice)).valueOf()",(await this.chef.pendingHbtShow(0,alice)).valueOf().toString());
            await this.chef.withdraw(0, '20', { from: alice });
            // console.log("(await this.hbt.totalSupply()).valueOf()",(await this.hbt.totalSupply()).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(this.chef.address)).valueOf()",(await this.hbt.balanceOf(this.chef.address)).valueOf().toString())
            // console.log("(await this.chef.getUserRewardInfo(0,alice)).valueOf()",(await this.chef.getUserRewardInfo(0,alice)).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString())
            assert.equal((await this.hbt.totalSupply()).valueOf(), '30000');
            assert.equal((await this.hbt.balanceOf(this.chef.address)).valueOf(), '28222');
            assert.equal((await this.chef.getUserRewardInfo(0,alice)).valueOf(),'10441')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '1778');

            // Bob withdraws 15 LPs at block 450.
            //minter默认邀请人：((440-430)*(20-5)/(10+20+30+10-5)*1000+(450-440)*(20-5)/(10+20+30+10-5-20)*1000)*0.1 = 564
            //Alice 获得：((440-430)*(20-5)/(10+20+30+10-5)*1000+(450-440)*(20-5)/(10+20+30+10-5-20)*1000)-564 = 5077
            await time.advanceBlockTo('449')
            await this.chef.withdraw(0, '15', { from: bob });
            // console.log("(await this.hbt.totalSupply()).valueOf()",(await this.hbt.totalSupply()).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(this.chef.address)).valueOf()",(await this.hbt.balanceOf(this.chef.address)).valueOf().toString())
            // console.log("(await this.chef.getUserRewardInfo(0,bob)).valueOf()",(await this.chef.getUserRewardInfo(0,bob)).valueOf().toString())
            // console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString())
            assert.equal((await this.hbt.totalSupply()).valueOf(), '40000');
            assert.equal((await this.hbt.balanceOf(this.chef.address)).valueOf(), '37658');
            assert.equal((await this.chef.getUserRewardInfo(0,bob)).valueOf(),'10648')
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '2342');

            // // Carol withdraws 30 LPs at block 460.
            //minter默认邀请人：((420-418)*30/(10+20+30)*1000+(430-420)*30/(10+20+30+10)*1000+(440-430)*30/(10+20+30+10-5)*1000+(450-440)*30/(10+20+30+10-5-20)*1000+(460-450)*30/(10+20+30+10-5-20-15)*1000)*0.1 = 2656
            //Alice 获得：((420-418)*30/(10+20+30)*1000+(430-420)*30/(10+20+30+10)*1000+(440-430)*30/(10+20+30+10-5)*1000+(450-440)*30/(10+20+30+10-5-20)*1000+(450-440)*30/(10+20+30+10-5-20-15)*1000)-2656 = 23911
            await time.advanceBlockTo('459')
            console.log("befroe-(await this.chef.getUserRewardInfo(0,carol)).valueOf()",(await this.chef.getUserRewardInfo(0,carol)).valueOf().toString());
            console.log("befroe-(await this.chef.pendingHbt(0,carol)).valueOf()",(await this.chef.pendingHbt(0,carol)).valueOf().toString());
            console.log("befroe-(await this.chef.pendingHbtShow(0,carol)).valueOf()",(await this.chef.pendingHbtShow(0,carol)).valueOf().toString());
            await this.chef.withdraw(0, '30', { from: carol });
            console.log("(await this.hbt.totalSupply()).valueOf()",(await this.hbt.totalSupply()).valueOf().toString())
            console.log("(await this.hbt.balanceOf(this.chef.address)).valueOf()",(await this.hbt.balanceOf(this.chef.address)).valueOf().toString())
            console.log("(await this.chef.getUserRewardInfo(0,carol)).valueOf()",(await this.chef.getUserRewardInfo(0,carol)).valueOf().toString())
            console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString())
            assert.equal((await this.hbt.totalSupply()).valueOf(), '50000');
            assert.equal((await this.hbt.balanceOf(this.chef.address)).valueOf(), '45002');
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '4998');           
            assert.equal((await this.chef.getUserRewardInfo(0,carol)).valueOf(),'23912');

            await this.chef.extractReward(0,0,false,{from:alice});
            await this.chef.extractReward(0,0,false,{from:bob});
            await this.chef.extractReward(0,0,false,{from:carol});

            assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '10441');        
            assert.equal((await this.hbt.balanceOf(bob)).valueOf(), '10648');           
            assert.equal((await this.hbt.balanceOf(carol)).valueOf(), '23912');           
   
            
        });

        it('给每个POOL分配HBTToken', async () => {
            // 100 per block farming rate starting at block 500 with bonus until block 1000
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '1000', '500', '1000',this.playerBook.address, { from: alice });

            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.lp2.approve(this.chef.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 1
            await this.chef.add('10', this.lp.address, true);
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('509');
            await this.chef.deposit(0, '10', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 420
            await time.advanceBlockTo('519');
            await this.chef.add('20', this.lp2.address, true);
            // Alice should have 10*1000 pending reward
            assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '10000');
            // Bob deposits 10 LP2s at block 425
            await time.advanceBlockTo('524');
            await this.chef.deposit(1, '5', { from: bob });
            // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
            assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '11666');
            await time.advanceBlockTo('530');
            // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
            assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '13333');
            assert.equal((await this.chef.pendingHbt(1, bob)).valueOf(), '3333');
        });

        it('奖励期结束后，应该停止赠送HBT', async () => {
            // 1000 per block farming rate starting at block 600 with bonus until block 700
            this.chef = await MasterChef.new(this.hbt.address,this.hbtLock.address, '1000', '600', '700',this.playerBook.address, { from: alice });

            this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单

            await this.lp.approve(this.chef.address, '1000', { from: alice });
            await this.chef.add('1', this.lp.address, true);
            // Alice deposits 10 LPs at block 690
            await time.advanceBlockTo('689');
            await this.chef.deposit(0, '10', { from: alice });
            // At block 705, she should have 1000*15 = 15000 pending.
            await time.advanceBlockTo('705');
            assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '15000');
            // At block 706, Alice withdraws all pending rewards and should get 16000.
            await this.chef.withdraw(0, '0', { from: alice });
            assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '0');
            await this.chef.extractReward(0,0,false,{from:alice});
            console.log("(await this.hbt.totalSupply()).valueOf()",(await this.hbt.totalSupply()).valueOf().toString())
            console.log("(await this.hbt.balanceOf(alice)).valueOf()",(await this.hbt.balanceOf(alice)).valueOf().toString());
            console.log("(await this.hbt.balanceOf(minter)).valueOf()",(await this.hbt.balanceOf(minter)).valueOf().toString());
            assert.equal((await this.hbt.balanceOf(minter)).valueOf(), '1700');           
            assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '15300');
        });
    });
});
