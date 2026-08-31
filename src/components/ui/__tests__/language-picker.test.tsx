import {screen} from '@testing-library/react';
import { LanguagePickerSection } from '../language-picker';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import {LOCALES, LOCALE_LABELS} from '@/lib/i18n/types';

describe("LanguagePickerSection", () => {
    it("should render all available locale options", () => {        
        renderWithProviders(<LanguagePickerSection />)

        const options = screen.getAllByRole("option");
        expect(options).toHaveLength(LOCALES.length);

        LOCALES.forEach((locale) => {
            expect(screen.getByRole("option", { name: LOCALE_LABELS[locale] })).toBeVisible();
        })
    })
    it("should change language and persist selection to localStorage", async () => {
        const user = userEvent.setup();
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        renderWithProviders(<LanguagePickerSection />)

        const languagePicker = screen.getByRole("combobox");

        expect(languagePicker).toBeVisible();

        expect(languagePicker).toHaveValue("en");

        await user.selectOptions(languagePicker, "es");

        expect(languagePicker).toBeVisible();
        expect(languagePicker).toHaveValue("es");
        expect(setItemSpy).toHaveBeenCalledWith("scholar-wallet:locale", "es");
    })
    it("should initialize with the persisted locale from storage", async () => {
        const user = userEvent.setup();

        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
        getItemSpy.mockReturnValue("es");

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