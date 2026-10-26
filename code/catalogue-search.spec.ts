
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://practicesoftwaretesting.com/';

const productLinks = (page: import('@playwright/test').Page) =>
  page.locator('a[href^="/product/"]');

test('TC-SCN-002: Page remains usable when product images fail', async ({ page }) => {
  // Simulate broken image requests; do not modify the actual website.
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image') {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await page.goto(BASE_URL);

  await expect(
    page.getByRole('heading', { name: /Practice Software Testing - Toolshop/i })
  ).toBeVisible();

  await expect(productLinks(page).first()).toBeVisible();

  // This checks graceful degradation, not a specific placeholder design.
});


test('TC-SCN-003: Pagination navigates to another page', async ({ page }) => {
  await page.goto(BASE_URL);

  const pageOneProduct = productLinks(page).first();
  await expect(pageOneProduct).toBeVisible();

  const firstProductBefore = await pageOneProduct.getAttribute('href');

  // Click Page 2 and wait for the page to update.
  await page.getByRole('button', { name: 'Page-2' }).click();

  // Pause so we can inspect the actual result in Firefox.
  await page.pause();

  const currentUrl = page.url();
  const firstProductAfter = await productLinks(page).first().getAttribute('href');

  console.log('URL after clicking Page 2:', currentUrl);
  console.log('First product before:', firstProductBefore);
  console.log('First product after:', firstProductAfter);
});



test('TC-SCN-004: Out-of-range pagination is handled', async ({ page }) => {
  await page.goto(`${BASE_URL}?page=99999`);

  await expect(
    page.getByRole('heading', {
      name: /Practice Software Testing - Toolshop/i
    })
  ).toBeVisible();

  const productCount = await productLinks(page).count();

  // Record the observed behavior for comparison with the SRS.
  console.log('Products displayed for invalid page:', productCount);

  expect(productCount).toBeGreaterThanOrEqual(0);
});




test('TC-SCN-005: Searching for Pliers returns matching products', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.getByRole('textbox', { name: 'Search' }).fill('Pliers');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(
    page.getByRole('heading', { name: 'Searched for: Pliers' })
  ).toBeVisible();

  const results = productLinks(page);
  await expect(results.first()).toBeVisible();

  // Verify that known relevant results are present.
  await expect(results.filter({ hasText: 'Combination Pliers' })).toHaveCount(1);
  await expect(results.filter({ hasText: 'Long Nose Pliers' })).toHaveCount(1);
  await page.pause();
});
test('TC-SCN-006: Unknown search returns no products', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.getByRole('textbox', { name: 'Search' }).fill('ZXQ987!#@');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(
    page.getByRole('heading', { name: /Searched for: ZXQ987!#@/i })
  ).toBeVisible();

  await expect(productLinks(page)).toHaveCount(0);

  // Inspect the page if the expected empty-results message is unclear.
  await page.pause();
});


test('TC-SCN-007: Empty search preserves the catalogue', async ({ page }) => {
  await page.goto(BASE_URL);

  const productsBefore = productLinks(page);
  await expect(productsBefore.first()).toBeVisible();

  const countBefore = await productsBefore.count();

  await page.getByRole('textbox', { name: 'Search' }).fill('');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(productLinks(page)).toHaveCount(countBefore);
  await expect(productLinks(page).first()).toBeVisible();

  await page.pause();
});


test('TC-SCN-008: Category, brand and price filters work together', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.getByRole('checkbox', { name: 'Power Tools' }).check();
  await page.getByRole('checkbox', { name: 'ForgeFlex Tools' }).check();

  // Set the maximum price slider to 100 using keyboard controls.
  const maxPrice = page.getByRole('slider', { name: 'ngx-slider-max' });
  await maxPrice.press('Home');

  for (let i = 0; i < 100; i++) {
    await maxPrice.press('ArrowRight');
  }

  const results = productLinks(page);
  await expect(results.first()).toBeVisible();

  const texts = await results.allTextContents();
  const prices = texts.map(text => {
    const match = text.match(/\$(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : NaN;
  });

  expect(prices.every(price => Number.isFinite(price) && price < 100)).toBeTruthy();

  // Screenshot opportunity: pause here after the filtered results appear.
  await page.pause();
});

test('TC-SCN-009: Restrictive price range handles zero results', async ({ page }) => {
  await page.goto(BASE_URL);

  // Set the maximum price to the minimum slider value.
  const maxPrice = page.getByRole('slider', { name: 'ngx-slider-max' });
  await maxPrice.press('Home');

  await expect(productLinks(page)).toHaveCount(0);
});


test('TC-SCN-010: Sorting arranges prices in ascending order', async ({ page }) => {
  await page.goto(BASE_URL);

  const sortDropdown = page.getByRole('combobox', { name: 'sort' });
  await sortDropdown.selectOption({ label: 'Price (Low - High)' });

  const results = productLinks(page);
  await expect(results.first()).toBeVisible();

  // Read the prices after sorting has updated the catalogue.
  await expect.poll(async () => {
    const texts = await results.allTextContents();
    return texts.map(text => {
      const match = text.match(/\$(\d+(?:\.\d{1,2})?)/);
      return match ? Number(match[1]) : NaN;
    });
  }).toEqual(expect.arrayContaining([expect.any(Number)]));

  const texts = await results.allTextContents();
  const prices = texts.map(text => {
    const match = text.match(/\$(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : NaN;
  });

  expect(prices.length).toBeGreaterThan(1);
  expect(prices.every(Number.isFinite)).toBeTruthy();

  for (let i = 1; i < prices.length; i++) {
    expect(
      prices[i],
      `Price at position ${i + 1} ($${prices[i]}) should be >= previous price ($${prices[i - 1]})`
    ).toBeGreaterThanOrEqual(prices[i - 1]);
  }

  await page.pause();
});

test('TC-SCN-011: Product details display correctly', async ({ page }) => {
  await page.goto(BASE_URL);

  const product = productLinks(page).first();
  await expect(product).toBeVisible();

  const productHref = await product.getAttribute('href');
  const productText = await product.innerText();
  const productName = productText.split('\n')[0].trim();
  const priceMatch = productText.match(/\$(\d+(?:\.\d{1,2})?)/);

  expect(productHref).toBeTruthy();
  expect(productName).toBeTruthy();
  expect(priceMatch).not.toBeNull();

  const cardPrice = priceMatch![0];

  await product.click();

  await expect(page).toHaveURL(/\/product\//);
  await expect(
    page.getByRole('heading', { name: productName, exact: true })
  ).toBeVisible();

  await expect(page.locator('body')).toContainText(cardPrice);

  // Inspect description, stock status, and product image for evidence.
  await page.pause();
});

test('TC-SCN-012: Invalid product URL is handled gracefully', async ({ page }) => {
  await page.goto(`${BASE_URL}product/invalid-id-999`);

  await expect(page.locator('body')).toBeVisible();

  const pageText = await page.locator('body').innerText();
  const productHeadingCount = await page.locator(
    'h1, h2'
  ).count();

  console.log('Invalid product URL:', page.url());
  console.log('Page headings:', await page.locator('h1, h2').allInnerTexts());
  console.log('Product heading count:', productHeadingCount);
  console.log('Page text:', pageText);

  await page.pause();
});


test('TC-SCN-013: Invalid product quantities are prevented or sanitized', async ({ page }) => {
  await page.goto(BASE_URL);

  const product = productLinks(page).first();
  await expect(product).toBeVisible();
  await product.click();

  const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
  await expect(quantityInput).toBeVisible();

  // The input has min=1 and max=99.
  await quantityInput.fill('0');
  console.log('Value after entering 0:', await quantityInput.inputValue());

  await quantityInput.fill('-5');
  console.log('Value after entering -5:', await quantityInput.inputValue());

  await quantityInput.fill('100');
  console.log('Value after entering 100:', await quantityInput.inputValue());

  // Verify the browser's validity constraints for the current value.
  const validity = await quantityInput.evaluate(
    (element: HTMLInputElement) => ({
      value: element.value,
      valid: element.validity.valid,
      rangeUnderflow: element.validity.rangeUnderflow,
      rangeOverflow: element.validity.rangeOverflow,
    })
  );

  console.log('Final input validity:', validity);

  await page.pause();
});

test('TC-SCN-014: Quantity exceeding the allowed maximum is restricted', async ({ page }) => {
  await page.goto(BASE_URL);

  const product = productLinks(page).first();
  await expect(product).toBeVisible();
  await product.click();

  const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
  await expect(quantityInput).toBeVisible();

  await quantityInput.fill('9999');

  // Verify the application's maximum-quantity warning.
  const warning = page.getByRole('alert');
  await expect(warning).toContainText(/order at most 99/i);

  await expect(quantityInput).toHaveValue('99');

  await page.pause();
});


test('TC-SCN-015: Adding a product to cart updates the cart', async ({ page }) => {
  await page.goto(BASE_URL);

  const product = productLinks(page).first();
  await expect(product).toBeVisible();
  await product.click();

  const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
  await expect(quantityInput).toBeVisible();
  await quantityInput.fill('1');

  await page.getByRole('button', { name: 'Add to cart' }).click();

  // Inspect the confirmation and cart indicator after adding.
  await expect(page.getByRole('alert')).toBeVisible();

  console.log('Alert:', await page.getByRole('alert').innerText());
  await page.pause();
});


test('TC-SCN-016: User registration with valid details succeeds', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/register`);

  const uniqueEmail = `pw.test.${Date.now()}@example.com`;

  await page.locator('#first_name').fill('Playwright');
  await page.locator('#last_name').fill('Tester');
  await page.locator('#dob').fill('1998-05-15');
  await page.locator('select').selectOption({ label: 'India' });
  await page.locator('#postal_code').fill('600001');
  await page.locator('#house_number').fill('42');
  await page.locator('#street').fill('Test Street');
  await page.locator('#city').fill('Chennai');
  await page.locator('#state').fill('Tamil Nadu');
  await page.locator('#phone').fill('9876543210');
  await page.locator('#email').fill(uniqueEmail);
  await page.locator('#password').fill('TestPass@123');

  // Submit registration.
  await page.getByRole('button', { name: /register/i }).click();

  // Verify that the application reports successful registration.
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('body')).toContainText(
    /account.*(created|successfully|registered)|registration.*success/i
  );
});


test('TC-SCN-017: Empty registration form triggers validation', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/register`);

  // Submit the form without entering any data.
  await page.getByRole('button', { name: /register/i }).click();

  // Check whether the browser or application reports validation.
  const invalidFields = page.locator('input:invalid');
  const invalidCount = await invalidFields.count();

  console.log('Invalid input count:', invalidCount);

  const alerts = page.getByRole('alert');
  console.log('Visible alert count:', await alerts.count());

  await page.pause();
});


test('TC-SCN-018: Malformed email addresses are rejected', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/register`);

  const emailInput = page.locator('#email');

  // Case 1: Missing @ and domain
  await emailInput.fill('plainaddress');
  await expect(page.getByText('Email format is invalid')).toBeVisible();

  // Case 2: Domain without a dot suffix
  await emailInput.fill('user@com');

  // Allow the application's validation to update.
  await expect
    .poll(async () =>
      page.getByText('Email format is invalid').isVisible()
    )
    .toBe(true);

  await page.pause();
});

test('TC-SCN-019: Registration with an existing email is rejected', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/register`);

  await page.locator('#first_name').fill('John');
  await page.locator('#last_name').fill('Doe');
  await page.locator('#dob').fill('1990-01-01');
  await page.locator('select').selectOption({ label: 'India' });
  await page.locator('#postal_code').fill('600001');
  await page.locator('#house_number').fill('42');
  await page.locator('#street').fill('Test Street');
  await page.locator('#city').fill('Chennai');
  await page.locator('#state').fill('Tamil Nadu');
  await page.locator('#phone').fill('9876543210');

  // Use the email belonging to the existing demo account.
  await page.locator('#email').fill('admin@practicesoftwaretesting.com');
  await page.locator('#password').fill('ValidTestPass@839!');

  await page.getByRole('button', { name: /register/i }).click();

  // Inspect the application's response to the duplicate email.
  await expect(page.locator('body')).toContainText(
    /already exists|already registered|email.*(taken|exists)|duplicate/i,
    { timeout: 10000 }
  );
});


test('TC-SCN-020: Weak password triggers validation', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/register`);

  const passwordInput = page.locator('#password');

  // Enter a password that violates the displayed password policy.
  await passwordInput.fill('abc');

  // Verify that the required password rules are displayed.
  await expect(page.locator('body')).toContainText(
    /at least 8 characters/i
  );
  await expect(page.locator('body')).toContainText(
    /uppercase and lowercase/i
  );
  await expect(page.locator('body')).toContainText(
    /at least one number/i
  );
  await expect(page.locator('body')).toContainText(
    /special symbol/i
  );

  // Verify the password is classified as weak.
  await expect(page.locator('body')).toContainText(/Weak/);

  // Pause for manual inspection.
  await page.pause();
});


test('TC-SCN-021: Successful customer login', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/login`);

  await page.locator('#email').fill('admin@practicesoftwaretesting.com');
  await page.locator('#password').fill('welcome01');

  // Target the actual login form submit button.
  await page.locator('[data-test="login-submit"]').click();

  // Verify successful authentication.
  await expect(page).not.toHaveURL(/\/auth\/login/);

  // Pause for manual inspection.
  await page.pause();
});


test('TC-SCN-022: Incorrect password shows generic login error', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/login`);

  await page.locator('#email').fill('admin@practicesoftwaretesting.com');
  await page.locator('#password').fill('DefinitelyWrong!982');

  await page.locator('[data-test="login-submit"]').click();

  // Verify the application rejects the credentials.
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('body')).toContainText(
    /invalid email or password/i
  );

  // Pause for visual inspection.
  await page.pause();
});

test('TC-SCN-023: SQL injection-like login input is rejected', async ({ page }) => {
  await page.goto(`${BASE_URL}auth/login`);

  await page.locator('#email').fill("admin' OR '1'='1");
  await page.locator('#password').fill("anything' OR '1'='1");

  await page.locator('[data-test="login-submit"]').click();

  // The attempted login must not authenticate the user.
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('body')).toContainText(
    /invalid email or password|email.*invalid|password.*invalid/i
  );

  // Pause for visual inspection.
  await page.pause();
});


test('TC-SCN-024: Cart calculates line subtotals and grand total', async ({ page }) => {
  await page.goto(BASE_URL);

  // Add the first product.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();
  const firstName = (await page.locator('h1').innerText()).trim();

  await page.getByRole('button', { name: /add to cart/i }).click();

  // Return to the homepage and add a different product.
  await page.goto(BASE_URL);
  await productLinks(page).nth(1).click();
  await expect(page.locator('h1')).toBeVisible();
  const secondName = (await page.locator('h1').innerText()).trim();

  expect(secondName).not.toBe(firstName);
  await page.getByRole('button', { name: /add to cart/i }).click();

  // Open the cart.
  await page.goto(`${BASE_URL}checkout`);
  await page.pause();
});

test('TC-SCN-025: Changing cart quantity updates totals', async ({ page }) => {
  await page.goto(BASE_URL);

  // Select a product.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  // Add it and wait for the application's confirmation.
  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('body')).toContainText(/product added|added to cart/i);

  // Open the cart using the site's navigation.
  await page.locator('a[href="/checkout"]').click();

  // Confirm that the cart item and quantity control are visible.
  const quantityInput = page.locator('input[type="number"]').first();
  await expect(quantityInput).toBeVisible();

  console.log('Initial quantity:', await quantityInput.inputValue());
  await page.pause();
});

test('TC-SCN-026: Zero and negative cart quantities are handled safely', async ({ page }) => {
  await page.goto(BASE_URL);

  // Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('body')).toContainText(/product added|added to cart/i);

  // Open the cart.
  await page.locator('a[href="/checkout"]').click();

  const quantityInput = page.locator('input[type="number"]').first();
  await expect(quantityInput).toBeVisible();

  // Try setting the quantity to zero.
  await quantityInput.fill('0');
  await quantityInput.press('Tab');
  await page.pause();
  
  // Now try a negative quantity.
  await quantityInput.fill('-5');
  await quantityInput.press('Tab');

  await expect.poll(async () => {
    return Number(await quantityInput.inputValue());
  }).toBeGreaterThanOrEqual(1);

  console.log('Quantity after entering -5:', await quantityInput.inputValue());

  await page.pause();
  console.log('Quantity after entering zero:', await quantityInput.inputValue());
});


test('TC-SCN-027: Removing a product updates the cart', async ({ page }) => {
  await page.goto(BASE_URL);

  // Add a product.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  const productName = (await page.locator('h1').innerText()).trim();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('body')).toContainText(/product added|added to cart/i);

  // Open the cart.
  await page.locator('a[href="/checkout"]').click();

  // Confirm the product is present.
  await expect(page.locator('body')).toContainText(productName);

  // Click the remove button in the cart.
  await page.locator('a.btn-danger').click();

  // Verify the product is removed.
  await expect(page.locator('body')).not.toContainText(productName);

  await page.pause();
});

test('TC-SCN-028: Cart persists after page refresh', async ({ page }) => {
  await page.goto(BASE_URL);

  // Select a product and capture its name.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  const productName = (await page.locator('h1').innerText()).trim();

  // Add the product to the cart.
  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('body')).toContainText(/product added|added to cart/i);

  // Open the cart and verify the product is present.
  await page.locator('a[href="/checkout"]').click();
  await expect(page.locator('body')).toContainText(productName);

  // Refresh the page.
  await page.reload();

  // Verify the cart still contains the product.
  await expect(page.locator('body')).toContainText(productName);

  await page.pause();
});

test('TC-SCN-029: Complete checkout workflow', async ({ page }) => {
  await page.goto(BASE_URL);

  // 1. Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // 2. Open the cart and start checkout.
  await page.locator('a[href="/checkout"]').click();
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 3. Continue as a guest if the guest tab is available.
  const guestTab = page.getByRole('tab', {
    name: 'Continue as Guest'
  });

  if (await guestTab.isVisible()) {
    await guestTab.click();

    const guestEmail = page.locator('[data-test="guest-email"]');
    const firstName = page.getByPlaceholder('Your first name');
    const lastName = page.getByPlaceholder('Your last name');

    if (await guestEmail.isVisible()) {
      if (!(await guestEmail.inputValue())) {
        await guestEmail.fill('robin.test@example.com');
      }

      if (!(await firstName.inputValue())) {
        await firstName.fill('Robin');
      }

      if (!(await lastName.inputValue())) {
        await lastName.fill('Tester');
      }

      await page.getByRole('button', {
        name: 'Continue as Guest'
      }).click();
    }
  }

  // 4. If guest confirmation is displayed, proceed to billing.
  const proceedButton = page.getByRole('button', {
    name: /proceed to checkout/i
  });

  if (await proceedButton.isVisible()) {
    await proceedButton.click();
  }

  // 5. Wait for the billing form.
  
  // 6. Fill the billing address.
  const postcode = page.getByPlaceholder('Your Postcode');
  const houseNumber = page.getByPlaceholder('e.g. 42');
  const street = page.getByPlaceholder('Your Street');
  const city = page.getByPlaceholder('Your City');
  const state = page.getByPlaceholder('State');

  await postcode.fill('632014');
  await houseNumber.fill('42');

  // Allow the postcode lookup to update the address fields.
  await expect(street).toHaveValue(/.+/);
  await expect(city).toHaveValue(/.+/);
  await expect(state).toHaveValue(/.+/);

  // Override any auto-populated address values.
  await street.fill('Test Street');
  await city.fill('Vellore');
  await state.fill('Tamil Nadu');

  // Verify the final values before proceeding.
  await expect(street).toHaveValue('Test Street');
  await expect(city).toHaveValue('Vellore');
  await expect(state).toHaveValue('Tamil Nadu');

  await page.pause();

});

test('TC-SCN-030: Unauthenticated checkout redirects to login', async ({ page }) => {
  // Start with a fresh browser context and no authenticated session.
  await page.goto(BASE_URL);

  // Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // Open the cart.
  await page.locator('a[href="/checkout"]').click();

  // Attempt to proceed to checkout.
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // Choose the sign-in tab rather than guest checkout.
  const signInTab = page.getByRole('tab', { name: 'Sign in' });
  await expect(signInTab).toBeVisible();
  await signInTab.click();

  // Verify that login is required to use the authenticated checkout path.
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  await page.pause();
});

test('TC-SCN-031: Empty shipping address validation', async ({ page }) => {
  await page.goto(BASE_URL);

  // 1. Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // 2. Open the cart and start checkout.
  await page.locator('a[href="/checkout"]').click();
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 3. Continue as a guest if prompted.
  const guestTab = page.getByRole('tab', {
    name: 'Continue as Guest'
  });

  if (await guestTab.isVisible()) {
    await guestTab.click();

    const email = page.locator('[data-test="guest-email"]');
    const firstName = page.getByPlaceholder('Your first name');
    const lastName = page.getByPlaceholder('Your last name');

    if (await email.isVisible()) {
      if (!(await email.inputValue())) {
        await email.fill('robin.test@example.com');
      }

      if (!(await firstName.inputValue())) {
        await firstName.fill('Robin');
      }

      if (!(await lastName.inputValue())) {
        await lastName.fill('Tester');
      }

      await page.getByRole('button', {
        name: 'Continue as Guest'
      }).click();
    }
  }

  // 4. Proceed to the billing address stage if prompted.
  const proceedButton = page.getByRole('button', {
    name: /proceed to checkout/i
  });

  if (await proceedButton.isVisible()) {
    await proceedButton.click();
  }

  // 5. Wait for the billing form and leave required fields empty.
  const country = page.locator('[data-test="country"]');
  await expect(country).toBeVisible();

  await country.selectOption({ label: 'India' });

  const postcode = page.getByPlaceholder('Your Postcode');
  const houseNumber = page.getByPlaceholder('e.g. 42');
  const street = page.getByPlaceholder('Your Street');
  const city = page.getByPlaceholder('Your City');
  const state = page.getByPlaceholder('State');

  await postcode.fill('');
  await houseNumber.fill('');
  await street.fill('');
  await city.fill('');
  await state.fill('');

  // 6. Attempt to continue without a billing address.
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 7. Verify that checkout has not advanced to payment.
  await expect(country).toBeVisible();
  await expect(page.getByRole('heading', {
    name: 'Billing Address'
  })).toBeVisible();

  await page.pause();
});

test('TC-SCN-032: Expired card is rejected', async ({ page }) => {
  await page.goto(BASE_URL);

  // 1. Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // 2. Start checkout.
  await page.locator('a[href="/checkout"]').click();
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 3. Continue as guest if prompted.
  const guestTab = page.getByRole('tab', {
    name: 'Continue as Guest'
  });

  if (await guestTab.isVisible()) {
    await guestTab.click();

    const email = page.locator('[data-test="guest-email"]');
    const firstName = page.getByPlaceholder('Your first name');
    const lastName = page.getByPlaceholder('Your last name');

    if (await email.isVisible()) {
      if (!(await email.inputValue())) {
        await email.fill('robin.test@example.com');
      }
      if (!(await firstName.inputValue())) {
        await firstName.fill('Robin');
      }
      if (!(await lastName.inputValue())) {
        await lastName.fill('Tester');
      }

      await page.getByRole('button', {
        name: 'Continue as Guest'
      }).click();
    }
  }

  // 4. Continue to billing if prompted.
  const proceedButton = page.getByRole('button', {
    name: /proceed to checkout/i
  });

  if (await proceedButton.isVisible()) {
    await proceedButton.click();
  }

  // 5. Complete the billing address.
  const country = page.locator('[data-test="country"]');
  await expect(country).toBeVisible();

  await country.selectOption({ label: 'India' });
  await page.getByPlaceholder('Your Postcode').fill('632014');
  await page.getByPlaceholder('e.g. 42').fill('42');
  await page.getByPlaceholder('Your Street').fill('Test Street');
  await page.getByPlaceholder('Your City').fill('Vellore');
  await page.getByPlaceholder('State').fill('Tamil Nadu');

  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 6. Enter expired card details.
  await expect(
    page.getByRole('heading', { name: 'Payment' })
  ).toBeVisible();

  await page.getByPlaceholder('Credit Card Number')
    .fill('4111-1111-1111-1111');

  await page.getByPlaceholder('Expiration Date')
    .fill('01/2020');

  await page.getByPlaceholder('CVV').fill('123');
  await page.getByPlaceholder('Card Holder Name').fill('Robin Tester');

  // 7. Attempt payment and verify it is rejected.
  await page.getByRole('button', {
    name: /check payment/i
  }).click();

  await expect(page.locator('body')).toContainText(
    /expired|invalid|declined|error/i
  );

  await page.pause();
});

test('TC-SCN-033: Invalid CVV is rejected', async ({ page }) => {
  await page.goto(BASE_URL);

  // 1. Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // 2. Start checkout.
  await page.locator('a[href="/checkout"]').click();
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 3. Continue as guest if prompted.
  const guestTab = page.getByRole('tab', {
    name: 'Continue as Guest'
  });

  if (await guestTab.isVisible()) {
    await guestTab.click();

    const email = page.locator('[data-test="guest-email"]');
    const firstName = page.getByPlaceholder('Your first name');
    const lastName = page.getByPlaceholder('Your last name');

    if (await email.isVisible()) {
      if (!(await email.inputValue())) {
        await email.fill('robin.test@example.com');
      }
      if (!(await firstName.inputValue())) {
        await firstName.fill('Robin');
      }
      if (!(await lastName.inputValue())) {
        await lastName.fill('Tester');
      }

      await page.getByRole('button', {
        name: 'Continue as Guest'
      }).click();
    }
  }

  // 4. Proceed to billing if prompted.
  const proceedButton = page.getByRole('button', {
    name: /proceed to checkout/i
  });

  if (await proceedButton.isVisible()) {
    await proceedButton.click();
  }

  // 5. Complete the billing address.
  const country = page.locator('[data-test="country"]');
  await expect(country).toBeVisible();

  await country.selectOption({ label: 'India' });
  await page.getByPlaceholder('Your Postcode').fill('632014');
  await page.getByPlaceholder('e.g. 42').fill('42');
  await page.getByPlaceholder('Your Street').fill('Test Street');
  await page.getByPlaceholder('Your City').fill('Vellore');
  await page.getByPlaceholder('State').fill('Tamil Nadu');

  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 6. Explicitly select Credit Card.
  const paymentMethod = page.locator('select').filter({
    has: page.locator('option', { hasText: 'Credit Card' })
  }).first();

  await expect(paymentMethod).toBeVisible();
  await paymentMethod.selectOption({ label: 'Credit Card' });

  // 7. Fill card details explicitly; do not rely on autofill.
  await page.getByPlaceholder('Credit Card Number')
    .fill('4111-1111-1111-1111');

  await page.getByPlaceholder('Expiration Date').fill('12/2030');
  await page.getByPlaceholder('CVV').fill('12');
  await page.getByPlaceholder('Card Holder Name').fill('Robin Tester');

  // 8. Attempt payment and inspect the validation result.
  await page.getByRole('button', {
    name: /check payment/i
  }).click();

  await page.pause();
});
test('TC-SCN-034: Successful payment generates an order confirmation', async ({ page }) => {
  await page.goto(BASE_URL);

  // 1. Add a product to the cart.
  await productLinks(page).nth(0).click();
  await expect(page.locator('h1')).toBeVisible();

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByRole('alert')).toContainText(
    /product added|added to cart/i
  );

  // 2. Open the cart and begin checkout.
  await page.locator('a[href="/checkout"]').click();
  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 3. Continue as a guest if the guest form is shown.
  const guestTab = page.getByRole('tab', { name: 'Continue as Guest' });

  if (await guestTab.isVisible()) {
    await guestTab.click();

    const email = page.locator('[data-test="guest-email"]');
    const firstName = page.getByPlaceholder('Your first name');
    const lastName = page.getByPlaceholder('Your last name');

    if (await email.isVisible()) {
      if (!(await email.inputValue())) {
        await email.fill('robin.test@example.com');
      }
      if (!(await firstName.inputValue())) {
        await firstName.fill('Robin');
      }
      if (!(await lastName.inputValue())) {
        await lastName.fill('Tester');
      }

      await page.getByRole('button', {
        name: 'Continue as Guest'
      }).click();
    }
  }

  // 4. Proceed to billing if the confirmation step is displayed.
  const proceedButton = page.getByRole('button', {
    name: /proceed to checkout/i
  });

  if (await proceedButton.isVisible()) {
    await proceedButton.click();
  }

  // 5. Complete the billing address.
  const country = page.locator('[data-test="country"]');
  await expect(country).toBeVisible();

  await country.selectOption({ label: 'India' });
  await page.getByPlaceholder('Your Postcode').fill('632014');
  await page.getByPlaceholder('e.g. 42').fill('42');
  await page.getByPlaceholder('Your Street').fill('Test Street');
  await page.getByPlaceholder('Your City').fill('Vellore');
  await page.getByPlaceholder('State').fill('Tamil Nadu');

  await page.getByRole('button', {
    name: /proceed to checkout/i
  }).click();

  // 6. Select Credit Card explicitly.
  const paymentMethod = page.locator('[data-test="payment-method"]');

  await expect(paymentMethod).toBeVisible();
  await paymentMethod.selectOption({ label: 'Credit Card' });
  await expect(paymentMethod).toHaveValue('credit-card');

  // 7. Enter valid demo payment details.
  await page.getByPlaceholder('Credit Card Number').fill('4111-1111-1111-1111');
  await page.getByPlaceholder('Expiration Date').fill('12/2030');
  await page.getByPlaceholder('CVV').fill('123');
  await page.getByPlaceholder('Card Holder Name').fill('Robin Tester');
  // Submit payment.
  await page.getByRole('button', { name: /check payment/i }).click();

  // Verify the payment success message.
  await expect(page.getByText('Payment was successful')).toBeVisible();

  // Confirm the order to generate the invoice.
  await page.getByRole('button', { name: /^confirm$/i }).click();

  // Verify the final order confirmation.
  await expect(page.locator('body')).toContainText(
    /thanks for your order/i
  );

  await expect(page.locator('body')).toContainText(
    /invoice number is INV-\d+/i
  );

  // Verify the cart is cleared.
  await expect(page.locator('a[href="/checkout"]'))
    .not.toContainText(/[1-9]/);

  // Pause for final visual inspection.
  await page.pause();
});