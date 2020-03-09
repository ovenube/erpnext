function openRestauranOrder(order){
    frappe.xcall('erpnext.restaurant.page.kitchen_view.kitchen_view.open_restaurant_order',
        {'restaurant_order': order}).then((r) => {
            frappe.set_route("Form", "Restaurant Order", order)
        })
 }