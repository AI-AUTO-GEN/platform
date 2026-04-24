const fs = require('fs');

const css = `
/* WALLET & BILLING STYLES */
.wallet-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}
.wallet-widget:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}
.wallet-balance {
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: -0.5px;
}
.wallet-add-btn {
  background: var(--accent);
  color: #000;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
}

.wallet-modal {
  width: 100%;
  max-width: 500px;
  padding: 0;
  overflow: hidden;
}

.wallet-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0,0,0,0.2);
}
.wm-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.wm-icon-box {
  background: rgba(var(--accent-rgb), 0.2);
  color: var(--accent);
  padding: 12px;
  border-radius: 12px;
}
.wm-header-left h2 {
  margin: 0;
  font-size: 1.2rem;
}

.wallet-balance-hero {
  padding: 30px 24px;
  text-align: center;
  background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
}
.wallet-balance-hero h1 {
  font-size: 3rem;
  margin: 10px 0 0 0;
  font-family: var(--font-mono);
  letter-spacing: -1px;
}

.wallet-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.w-tab {
  flex: 1;
  background: none;
  border: none;
  padding: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}
.w-tab:hover {
  color: white;
  background: rgba(255, 255, 255, 0.02);
}
.w-tab.active {
  color: white;
}
.w-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}

.wallet-modal-body {
  padding: 24px;
  min-height: 300px;
  max-height: 50vh;
  overflow-y: auto;
}

.amount-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 20px 0;
}
.amount-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}
.amount-card h3 {
  margin: 0 0 4px 0;
  font-size: 1.5rem;
  font-family: var(--font-mono);
}
.amount-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}
.amount-card.selected {
  background: rgba(var(--accent-rgb), 0.1);
  border-color: var(--accent);
  box-shadow: 0 0 15px rgba(var(--accent-rgb), 0.2);
}

.custom-amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.custom-amount-input {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.2rem;
  font-family: var(--font-mono);
}
.custom-amount-input input {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  font-family: var(--font-mono);
  width: 80px;
  text-align: right;
  outline: none;
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tx-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.tx-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}
.tx-icon.deposit { background: rgba(0, 255, 100, 0.1); color: #00ff64; }
.tx-icon.withdrawal { background: rgba(255, 50, 50, 0.1); color: #ff3232; }
.tx-icon.hold { background: rgba(255, 165, 0, 0.1); color: orange; }

.tx-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.tx-desc {
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 2px;
}
.tx-date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}
.tx-amount {
  font-family: var(--font-mono);
  font-weight: 600;
}
.tx-amount.positive { color: #00ff64; }
.tx-amount.negative { color: #ff3232; }
`;

fs.appendFileSync('f:\\NSK - PROJECTS\\AI AUTO GEN\\src\\index.css', css);
console.log('Appended CSS to index.css');
