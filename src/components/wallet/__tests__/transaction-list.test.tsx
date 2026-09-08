import { renderWithProviders, screen } from "@/test/test-utils";
import { TransactionList } from "../transaction-list";
import { Payment } from "@/lib/lightning/types";

const mockPayments: Payment[] = [
    {
    "id": "01a081ac-7076-7180-a02a-f2125ed43f4a",
    "paymentType": "sent",
    "paymentTime": 1788881957,
    "amount": 120,
    "fees": 2,
    "status": "complete",
    "description": "Pay to OliveSheep3647@breez.tips",
    "bolt11": "lnbc1200n1p42qtpzpp54hq3l7le3u3ptfcj2ylkwxrhl9snf86jjqml6pt497puv2w57rqssp50csan63vpzwrdw383d2ltrqsqkd96epw209y69cvlnzwgmff3q4qxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpuhp5zgy6ptupr8rdmjkw78qsl07z7q8lfpydudhfgnhnu8pqtky8re2s9qyyssq0l06h3xs6armf24xtwr5lntdrtznxnv50nd3shqncq92urxspgsknhdmkcjjr3jhlhfr3nfpnedr3dlhxvh90d9zprw32qu55m300zgpmp83th",
    "method": "lightning"
    },
    {
    "id": "01a059e3-a0a7-7a8f-84e5-255955b7d6d0",
    "paymentType": "received",
    "paymentTime": 1788214485,
    "amount": 120,
    "fees": 0,
    "status": "complete",
    "bolt11": "lnbc1200n1p4ftlxspp56xptws40dt20mv9nspqzl4dj3jvuk35354tqj9yryqywe6rlyzpssp5equw0yng4wamwu6t4pa5hqm2wk7px92faa037u2z6v3ws8fwgm0qxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpuhp52jftf4nd9y7h2kv4zg7lxau3cfnykzu9c8gxypaerj2lk9wfarfs9qyyssq3fed2ejacth67htsp3zjnanj5m0davc2vkrz98hk4p7fwvfrzxthyr9j4r204wavkealh9ftnkedgq7zu2qygljetdgykrwcuvnj5gcp5swmfu",
    "method": "lightning"
    },
    {
    "id": "d08e0eb94ac6bd89469da719c82f9aba5c099b5801d1f0b1c0cde87e9150e619:0",
    "paymentType": "received",
    "paymentTime": 1788214490,
    "amount": 632604,
    "fees": 0,
    "status": "complete",
    "method": "token",
    "conversionDetails": {
        "status": "completed",
        "from": {
            "amount": 803,
            "fee": 0,
            "ticker": "BTC",
            "decimals": 0
        },
        "to": {
            "amount": 632604,
            "fee": 0,
            "ticker": "USDB",
            "decimals": 6
        }
    },
    "purpose": "autoConversion"
    },
    {
    "id": "01a059e6-4641-7a42-a095-5fb9d5fc635f",
    "paymentType": "received",
    "paymentTime": 1788214663,
    "amount": 801,
    "fees": 0,
    "status": "complete",
    "method": "spark",
    "conversionDetails": {
        "status": "completed",
        "from": {
            "amount": 632604,
            "fee": 634,
            "ticker": "USDB",
            "decimals": 6
        },
        "to": {
            "amount": 801,
            "fee": 0,
            "ticker": "BTC",
            "decimals": 0
        }
    },
    "purpose": "autoConversion"
}]

describe("TransactionList", () => {
    it("should render a placeholder when there are no payments", () => {
        renderWithProviders(<TransactionList payments={[]} />);
        
        expect(screen.getByRole('heading', { name: /recent activity/i })).toBeVisible();
        expect(screen.getByText(/No transactions yet/i)).toBeVisible();
        expect(screen.queryByText(/Your transactions will appear here/i)).toBeVisible()
    });
    it("should render a list of payments", () => {
        renderWithProviders(<TransactionList payments={mockPayments} />);
        
        expect(screen.getByRole('heading', { name: /recent activity/i })).toBeVisible();
        expect(screen.queryByText(/No transactions yet/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Your transactions will appear here/i)).not.toBeInTheDocument()
        
        const payments = screen.getAllByRole("button");
        
        const typeSent = payments[0];
        const typeReceived = payments[1];
        const typeReceivedConversion = payments[2];
        const typeReceivedConversion2 = payments[3];

        expect(payments).toHaveLength(mockPayments.length);

        expect(typeSent).toHaveTextContent(`${mockPayments[0].description}`);
        expect(typeSent).toHaveTextContent(`-${mockPayments[0].amount}`);

        expect(typeReceived).toHaveTextContent(/received payment/i);
        expect(typeReceived).toHaveTextContent(`+${mockPayments[1].amount}`);

        expect(typeReceivedConversion).toHaveTextContent(/conversion to USDB/i);
        expect(typeReceivedConversion).toHaveTextContent(/\+\$0\.63/i);

        expect(typeReceivedConversion2).toHaveTextContent(/conversion to bitcoin/i);
        expect(typeReceivedConversion2).toHaveTextContent(`+${mockPayments[3].amount}`);
    });
});