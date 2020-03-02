frappe.pages['table-board'].on_page_load = function(wrapper) {
	new TableBoard(wrapper);
};

TableBoard = Class.extend({
	init: function(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Table Board',
			single_column: true
		});

		const assets = [
			'assets/erpnext/css/table_board.css'
		];

		frappe.require(assets, () => {
			this.make();
			this.load_floors();
			this.load_tables()
		});
	},

	make: function() {
		$(frappe.render_template("table_board", this)).appendTo(this.page.main)
	},

	load_floors: function() {
		frappe.db.get_list("Restaurant Floor", {fields: ["floor"]}).then((result) => {
			if (result == []){
				frappe.throw(__("Restaurant Floor is required to use Table Board"));
			} else {
				result.forEach(floor => {
					$('#floors').append($('<option>').val(floor.floor).text(floor.floor));
				});
			}
		});
	},

	load_tables: function() {
		var floors = document.getElementById("floors");
		floors.onchange = function(){
			var selected_floor = floors.options[floors.selectedIndex].text;
			if (selected_floor == "Delivery"){
				$('#delivery-orders').empty();
				$("#tables").empty();
				frappe.db.get_list("Restaurant Order", {fields: ['name', 'order_status', 'time'], filters: {restaurant_table: "", order_status: ['in', ['Taken', 'In progress']]}}).then((result) => {
					result.forEach(order => {
						$('#delivery-orders').append(`
						<div class="col-sm-2 col-xs-4 tableList nohover-item" style="">
							<a class="btn btn-lg ` + (order.order_status == "Taken" ? "deliverytableoff-btn" : "deliverytable-btn")  +`" href="#restaurant-pos/delivery/` + order.name + `">`+ order.time +`</a>
						</div>`);
					})
				})
			} else {
				$('#delivery-orders').empty();
				$("#tables").empty();
				frappe.db.get_list("Restaurant Table", {fields: ['name', 'occupied', 'time'], filters: {floor: selected_floor}}).then((result) => {
					if (result == []){
						frappe.msgprint(__("Please add Restaurant Tables"));
					} else {
						result.forEach(table => {
							$('#tables').append(`
							<div class="col-sm-2 col-xs-4 tableList">
								<a href="#restaurant-pos/` + table.name.replace(" ", "%20") + `">
									<img src="assets/erpnext/images/` + (table.occupied == 1 ? "tableB2.svg" : "table.svg") + `" alt="table">
									<h2>`+ table.name.slice(-2) + `</h2>
								</a>
							</div>`);
						});
					}
				});
			}
		};
	},
});