import React from 'react';
import { Button, Modal, Row, Col, ModalHeader, ModalBody, Input } from 'reactstrap';
import API from "../../utils/API";
import "./BarcodeModal.css";
import moment from "moment"

class BarcodeModal extends React.Component {
    constructor(props) {
        super(props);
        this.onResponseFromBarcode = this.onResponseFromBarcode.bind(this);
        this.state = {
            modal: false,
            constraints: {
                video: {
                    deviceId: { exact: undefined },
                    height: { ideal: 1080 },
                    width: { ideal: 1920 }
                }
            },
            deviceNames: [],
            preferredDevice: null,
            searchedFood: "",
            firstDisplay: "reveal",
            secondDisplay: "d-none",
            results: [],
            quantity: 1,
            selectedMeal: ""
        };

        this.initMedia()
        this.toggle = this.toggle.bind(this);
    }

    onResponseFromBarcode = response => {
        // console.log("this is the responseFromIR: ", response.data)
        let now = new Date().getTime();
        let today = new Date();
        let breakfastStartTime = today.setHours(6, 0, 0, 0);
        let breakfastEndTime = today.setHours(9, 0, 0, 0);
        let lunchStartTime = today.setHours(11, 30, 0, 0);
        let lunchEndTime = today.setHours(14, 0, 0, 0);
        let dinnerStartTime = today.setHours(17, 0, 0, 0);
        let dinnerEndTime = today.setHours(20, 0, 0, 0);
        if ((breakfastStartTime <= now) && (now <= breakfastEndTime)) {
            this.setState({ selectedMeal: "Breakfast" })
        } else if ((lunchStartTime <= now) && (now <= lunchEndTime)) {
            this.setState({ selectedMeal: "Lunch" })
        } else if ((dinnerStartTime <= now) && (now <= dinnerEndTime)) {
            this.setState({ selectedMeal: "Dinner" })
        } else {
            this.setState({ selectedMeal: "Snack" })
        }
        // this.setState({ secondDisplay: "reveal" })
        if (response.code !== "000") {
            alert(`Image is not identifyable!`)
            this.resetModal();
        } else {
            this.setState({ results: response.data, secondDisplay: "reveal" })
            // console.log("this is from nutritionix: ", this.state.results)
            this.setState({ firstDisplay: "d-none" })
        }
    }

    resetModal = () => {
        this.video.play();
    }

    initMedia = () => {
        navigator.mediaDevices.getUserMedia({video:true}).then(stream => {
            navigator.mediaDevices.enumerateDevices().then(devices => {
              this.gotDevices(devices)
              this.setState({ constraints: { video: { deviceId: { exact: this.state.preferredDevice.deviceId } } } })
              console.log(`*** the preferred deviceid now set to: ${this.state.constraints.video.deviceId.exact}`)
              return devices;
            }).then(stream => {
            }).catch(this.handleError);
          })   
    }

    gotDevices = (deviceInfos) => {
        // Handles being called several times to update labels. Preserve values.
        // console.log(`"===> the device infoS are: ${JSON.stringify(deviceInfos)}`)

        let device_names = this.state.deviceNames
        let preferred_device = null
        for (let i = 0; i !== deviceInfos.length; ++i) {
            const deviceInfo = deviceInfos[i]
            // console.log(`"===> the device info is: ${JSON.stringify(deviceInfo)}`)
            const option = document.createElement('option')
            option.value = deviceInfo.deviceId
            if (deviceInfo.kind === 'videoinput') {
                // console.log("==> now appending the vidoeselection of: " + deviceInfo.label)

                device_names.push(deviceInfo.label);
                if (!this.state.preferredDevice) {
                    console.log(`now setting the preffered device to: ${JSON.stringify(deviceInfo)}`)
                    preferred_device = deviceInfo    // take a camera of some kind
                } else {
                    // if (deviceInfo.label === "Back Camera") {
                    if (deviceInfo.label.match('[Bb]ack|rear|environment')) {     // regex to match for back/Back camera
                        console.log(`now setting the preffered device to back camera: ${JSON.stringify(deviceInfo)}`)
                        preferred_device = deviceInfo   // prefer the back camera!
                    }
                }
            }
            this.setState({ deviceNames: device_names, preferredDevice: preferred_device })
        }
    }

    gotStream = (stream) => {
        window.stream = stream; // make stream available to console
        // console.log(`=== now setting the window stream to: ${JSON.stringify(stream)}`)
        this.video.srcObject = stream;
        // Refresh button list in case labels have become available
        return navigator.mediaDevices.enumerateDevices();
    }

    stopUsingCamera = () => {
        if (window.stream) {
            window.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
    }

    start = () => {
        if (window.stream) {
            window.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
        if (this.state.preferredDevice) {
            console.log(`the preferred Device id is: ${this.state.preferredDevice.deviceId}`)
        }
        // console.log(`the constraints is: ${JSON.stringify(this.state.constraints)}`)
        navigator.mediaDevices.getUserMedia(this.state.constraints).then(this.gotStream).then(this.gotDevices).catch(this.handleError)
    }

    handleError = (error) => {
        console.log('navigator.getUserMedia error: ', error);
    }

    toggle() {
        let new_modal_state = !this.state.modal
        this.setState({
            modal: new_modal_state,
            firstDisplay: "reveal",
            secondDisplay: "d-none",
            quantity: 1
        });
        if (new_modal_state) {
            this.start()
        } else {
            this.stopUsingCamera()
        }
    }

    videoOnClick = () => {
        let snap = this.takeSnapshot();
        // Show image. 
        this.image.setAttribute('src', snap);
        this.image.classList.add("visible");
        console.log(`going to hit the watson backend route now.....`)
        API.callScanBarcode(this.image.src).then(response => {
            // console.log(`the response back from the image recognition is: ${JSON.stringify(response.data)}`)
            this.onResponseFromBarcode(response.data)
        })
        this.video.pause();
    }

    takeSnapshot = () => {

        let context = this.canvas.getContext('2d');

        let width = 300,
            height = 200;

        if (width && height) {

            // Setup a canvas with the same dimensions as the video.
            this.canvas.width = width;
            this.canvas.height = height;

            // Make a copy of the current frame in the video on the canvas.
            context.drawImage(this.video, 0, 0, width, height);

            // Turn the canvas image into a dataURL that can be used as a src for our photo.
            return this.canvas.toDataURL('image/jpeg', 1.0);
        }
    }

    handleConsume = () => {
        // console.log(JSON.stringify(this.state.results))
        this.setState({ secondDisplay: "d-none" })
        console.log("quantity: " + this.state.quantity)
        this.toggle()
        this.setState({ firstDisplay: "reveal" })
        // TO DO: clear out forms after quantity entered
        this.toggle()
        this.setState({ secondDisplay: "d-none" })

        // new stuff for destructuring
        const { results, quantity, selectedMeal } = this.state

        API.createFood({
            item_name: results.food_name,
            quantity: quantity,
            nf_calories: results.nf_calories * quantity,
            nf_protein: results.nf_protein * quantity,
            nf_serving_size_unit: results.serving_unit,
            nf_total_carbohydrate: results.nf_total_carbohydrate * quantity,
            username: this.props.username,
            meal: selectedMeal,
            date_consumed: moment(this.props.date + " 00:00:00.000-0600").format("YYYY-MM-DD HH:mm:ss.SSS"),
            date_added: new Date(),
            date_modified: new Date()
        })
            .then(this.onResponseFromSearch)
            .catch(err => console.log(err));
    }

    onResponseFromSearch = () => {
        this.props.onResponseFromSearch();  // callback to our parent so it can reload state from Mongo
    }

    render() {
        return (
            <div>
                <Button color="danger" className="snap-button" onClick={this.toggle}><i className="fas fa-barcode"></i></Button>
                <Modal isOpen={this.state.modal} id="video-modal" toggle={this.toggle} className={this.props.className}>
                    <ModalHeader className={this.state.firstDisplay} toggle={this.toggle}>Touch image to snap barcode!</ModalHeader>
                    <ModalHeader className={this.state.secondDisplay} toggle={this.toggle}>Enter number of servings to eat:</ModalHeader>
                    <ModalBody>
                        <div id="videoimage" className={this.state.firstDisplay}>
                            <video ref={video => { this.video = video }} onClick={this.videoOnClick} className="videoInsert img-fluid" playsInline autoPlay />
                            <img ref={image => { this.image = image }} alt="food pic" className="d-none" />
                            <canvas ref={canvas => { this.canvas = canvas }} className="d-none" />
                        </div>
                        <div className={this.state.secondDisplay}>
                            <div>
                                <Row >
                                    <Col>
                                        <b>{this.state.results.food_name}</b>
                                    </Col>
                                </Row>
                                <Row className="mt-1">
                                    <Col>
                                        Calories: {this.state.results.nf_calories} | Serving: {this.state.results.serving_unit}
                                    </Col>
                                </Row>
                                <Row className="mt-2">
                                    <Col>
                                        <Input
                                            type="select"
                                            name="mealSelect"
                                            id="meal-select"
                                            className="form-control form-control-sm modal-meal-selector"
                                            value={this.state.selectedMeal}
                                            onChange={e => this.setState({ selectedMeal: e.target.value })}
                                        >
                                            <option>Breakfast</option>
                                            <option>Lunch</option>
                                            <option>Dinner</option>
                                            <option>Snack</option>
                                        </Input>
                                    </Col>
                                    <Col>
                                        <Input
                                            type="number"
                                            name="quantity"
                                            min="0"
                                            max="100"
                                            value={this.state.quantity}
                                            id="quantityText"
                                            className="form-control form-control-sm modal-quantity-selector"
                                            onChange={e => this.setState({ quantity: e.target.value })}
                                        >
                                        </Input>
                                    </Col>
                                    <Col>
                                        <button onClick={() => this.handleConsume()} className="results-button">Consume</button>
                                    </Col>
                                </Row>
                                <hr></hr>
                            </div>
                        </div>
                    </ModalBody>
                </Modal>
            </div >
        );
    }

}

export default BarcodeModal;