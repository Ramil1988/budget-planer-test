This dashboard, which appears to be a personal finance tracker, is built around two main components on the "20_December_2025" sheet: a detailed transaction log and an expense summary/budget analysis.

**1. Detailed Transaction Log (Columns A:E):**
This section records individual financial transactions and includes:

- **Date:** The date the transaction occurred.
- **Amount:** The monetary value of the transaction.
- **Provider:** The vendor or entity associated with the transaction.
- **Description:** A category or description of the expense (e.g., "Fuel," "Mortgage," "Weekend").
- **Balance:** The running account balance after the transaction.

**2. Expense Summary and Budget Analysis (Columns I:N):**
This table consolidates the expenses from the transaction log and provides a budget overview. It includes:

- **Expense item:** The category of the expense (e.g., "Mortgage," "Food/Costco," "Weekend").
- **SPENT:** The total amount spent for that category.
- **Limit:** The allocated budget limit for that category.
- **Rested:** The remaining amount of the budget (Limit - SPENT). A negative number indicates the budget limit was exceeded.
- **% of limit spent:** The percentage of the allocated limit that has been used.
- **% of budget spent:** The percentage of the _Grand Total_ budget that this item represents.
- **Additional Information:** The lower part of this table also contains scheduled payment dates and amounts for certain expense items (e.g., "Mortgage schedule," "AutoCredit schedule").

**Overall Idea:**
The dashboard's purpose is to meticulously log all financial transactions and then aggregate that data into a clear, category-based budget analysis, showing how much has been spent versus the allocated limits.

The main concept of this table, titled "Year 2025" on the "Tracking exp_2025" sheet, is to provide a **monthly and annual breakdown of expenses by category**.

This table serves as a comprehensive annual expense report, tracking how spending fluctuates across 18 predefined financial categories over the course of the year 2025.

**Key Components/Concept:**

1.  **Expense Categorization (Row Headers):** The first column (`Name of Category`) lists 18 distinct categories (e.g., Mortgage, Food/Costco, Autocredit, Weekend, Fuel) allowing for granular tracking.
2.  **Monthly Tracking (Column Headers):** Columns D through O record the total expenditure for each category during each month, from January 2025 through December 2025.
3.  **Annual Totals (`Overall`):** Column P sums the 12 monthly amounts for each category to provide the total expenditure for the entire year 2025.
4.  **Proportional Analysis (`Overall, %`):** Column Q shows the percentage contribution of each category's total spending to the `Grand Total` annual expense, highlighting the largest areas of expenditure.
5.  **Grand Total:** The final row sums up the total spending across all categories for each month, and the final cell in the `Overall` column provides the total amount spent for the entire year across all categories ($\\text{81,615.00}$).

In essence, the table is structured to answer two primary questions:

- How much was spent on _each_ category _every month_?
- What was the _total annual spending_ for each category and how does it compare to the _overall annual budget_?
