import {screen} from '@testing-library/react';
import { LanguagePickerSection } from '../language-picker';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import {LOCALES, LOCALE_LABELS} from '@/lib/i18n/types';

describe("LanguagePickerSection", () => {
    it("should render a language picker", async () => {
        const user = userEvent.setup();
        
        renderWithProviders(<LanguagePickerSection />)

        const languagePicker = screen.getByRole("combobox");

        expect(languagePicker).toBeVisible();

        expect(languagePicker).toHaveValue("en");
        expect(languagePicker).not.toHaveValue("es");

        await user.selectOptions(languagePicker, "es");

        expect(languagePicker).toBeVisible();
        expect(languagePicker).toHaveValue("es");
        expect(languagePicker).not.toHaveValue("en");
    })
    it("check persisted locale and available locales", async () => {
        const user = userEvent.setup();
        renderWithProviders(<LanguagePickerSection />)

        const languagePicker = screen.getByRole("combobox");
        expect(languagePicker).toHaveValue("en");

        await user.click(languagePicker);

        const options = screen.getAllByRole("option")
        expect(options).toHaveLength(LOCALES.length);

        LOCALES.forEach((locale) => {
            expect(screen.getByRole("option", { name: LOCALE_LABELS[locale] })).toBeVisible();
        })
    })
})