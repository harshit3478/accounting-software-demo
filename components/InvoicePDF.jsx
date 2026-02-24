import React from "react";

const InvoiceTemplate = () => {
  return (
    <div style={styles.container}>
      {/* TOP IMAGE / LOGO */}
      <div style={styles.logoWrapper}>
        <img
          src="/goldLogo.jpg" // replace with your logo path
          alt="Company Logo"
          style={styles.logo}
        />
      </div>

      {/* COMPANY INFO */}
      <div style={styles.companyInfo}>
        <h2>test test</h2>
        <p>Dallas-Fort Worth</p>
        <p>Texas</p>
        <p>United States</p>
        <p>954-111-2222</p>
      </div>

      {/* BILL TO + META */}
      <div style={styles.headerRow}>
        <div>
          <h3>BILL TO</h3>
          <p>Test Test</p>
          <p>Infinityz Jewelry</p>
          <p>9546489644</p>
          <p>coopercreekllc@outlook.com</p>
        </div>

        <div style={styles.meta}>
          <p>
            <b>Invoice Number:</b> 202238
          </p>
          <p>
            <b>Invoice Date:</b> February 13, 2026
          </p>
          <p>
            <b>Payment Due:</b> February 13, 2026
          </p>
          <p>
            <b>Amount Due:</b> $1,152.00
          </p>
        </div>
      </div>

      {/* TABLE */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>18k Saudi Gold Hardware Necklace (LW) 13.41</td>
            <td>1</td>
            <td>$899.00</td>
            <td>$899.00</td>
          </tr>
          <tr>
            <td>18k Saudi Gold Paper Clip Necklace 7.3 g</td>
            <td>1</td>
            <td>$453.00</td>
            <td>$453.00</td>
          </tr>
        </tbody>
      </table>

      {/* TOTALS */}
      <div style={styles.totalBox}>
        <p>
          <b>Total:</b> $1,352.00
        </p>
        <p>Payment on February 13, 2026: $200.00</p>
        <h2>Amount Due: $1,152.00</h2>
      </div>
    </div>
  );
};

export default InvoiceTemplate;

const styles = {
  container: {
    maxWidth: 900,
    margin: "auto",
    padding: 20,
    fontFamily: "Arial",
    background: "#fff",
  },
  logoWrapper: {
    textAlign: "center",
    marginBottom: 20,
  },
  logo: {
    maxWidth: 200,
  },
  companyInfo: {
    marginBottom: 20,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  meta: {
    textAlign: "right",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 20,
  },
  totalBox: {
    textAlign: "right",
  },
};
