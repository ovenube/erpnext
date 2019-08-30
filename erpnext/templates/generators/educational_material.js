frappe.ready(function(){
    function get_material(cicle, material) {
        frappe.call({
            method: "erpnext.templates.generators.educational_material.open_url",
            args: {
                'cicle': cicle,
                'material': material
            },
            callback: function(r) {
                if (r) {
                    var req = new XMLHttpRequest();
                    req.open('GET', r.message.url, true);
                    req.setRequestHeader('Authorization', "Token " + r.message.token);
                    req.onreadystatechange = function (aEvt) {
                        if (req.readyState == 4) {
                           if (req.status != 200){
                             alert("Error loading page\n");
                           }
                        }
                    };             
                    req.send();
                }
            }
        });
    }

    $(".btn-primary").click(function () {
        get_material(doc_info.cicle, $(this).attr('value'));
    });
});