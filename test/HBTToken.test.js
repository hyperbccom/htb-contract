const { expectRevert,BN } = require('@openzeppelin/test-helpers');
const HBTToken = artifacts.require('HBTToken');

contract('HBTToken', ([alice, bob, carol,dev]) => {
    beforeEach(async () => {
        this.hbt = await HBTToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        let addr = this.hbt.address;
        console.log(`addr:${addr}`);
        const name = await this.hbt.name();
        const symbol = await this.hbt.symbol();
        const decimals = await this.hbt.decimals();
        assert.equal(name.valueOf(), 'HBTToken');
        assert.equal(symbol.valueOf(), 'HBT');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.hbt.mint(alice, '100', { from: alice });
        await this.hbt.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.hbt.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.hbt.totalSupply();
        const aliceBal = await this.hbt.balanceOf(alice);
        const bobBal = await this.hbt.balanceOf(bob);
        const carolBal = await this.hbt.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.hbt.mint(alice, '100', { from: alice });
        await this.hbt.mint(bob, '1000', { from: alice });
        await this.hbt.transfer(carol, '10', { from: alice });
        await this.hbt.transfer(carol, '100', { from: bob });
        const totalSupply = await this.hbt.totalSupply();
        const aliceBal = await this.hbt.balanceOf(alice);
        const bobBal = await this.hbt.balanceOf(bob);
        const carolBal = await this.hbt.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.hbt.mint(alice, '100', { from: alice });
        await expectRevert(
            this.hbt.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.hbt.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });

    it('按照业务比例进行分配', async () => {
        let flow = new BN("300000000000000000000000000");
        let loan = new BN("300000000000000000000000000");
        let insurance = new BN("200000000000000000000000000");
        let team = new BN("200000000000000000000000000");

        await this.hbt.mint(alice, flow, { from: alice });
        await this.hbt.mint(bob, loan, { from: alice });
        await this.hbt.mint(carol, insurance, { from: alice });
        await this.hbt.mint(dev, team, { from: alice });
    });

    it('销毁代币', async () => {
        let flow = new BN("1000");
        await this.hbt.mint(alice, flow, { from: alice });
        assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '1000');

        await this.hbt.burn(flow, { from: alice });
        assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '0');
    });
  });
